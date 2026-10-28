# Engineering Decisions Note

Companion to the built slice. The exercise asks for one load-bearing piece built to its bar, with a short note on key decisions, what I would harden next, and how a teammate extends it.

## What I built and why

I built the **tenant-isolation guardrail** — the piece the brief calls a contractual, money-touching boundary that must never be cosmetic. It is also the one guarantee the other two pieces exist to protect: degraded mode is safe _because_ unverified exclusive rates cannot surface, and the identity handoff matters _because_ the tenantId it anchors is what the guardrail filters by. Owning it personally is the player-coach choice; the other two are designed in this note at port level and would be built next.

## How the guardrail is enforced (key decisions)

1. **Three structural layers, in order of strength.** The service reaches data only through the typed `OfferDataSource` port — it never holds a database handle. The repository binds `tenant_id` on every query at construction time (src/modules/offer/offer.repository.ts). And the database client's builder is typestate-split: `db('offers')` returns a builder whose only method is `where('tenant_id', ...)`, and only the tenant-scoped type can append filters or select — executing an unbound query is a compile error, not a hopeful runtime check. Runtime guards (refusing a missing, empty, or unknown tenant context with the typed `InvalidTenantContextError`) remain as defense-in-depth backstops only.
2. **Tests assert outcomes, not intent.** The test fake applies query clauses like a real database, and the breach tests seed rows that would violate the contract — an exclusive row tagged `tenant0`, and rows belonging to other tenants — then assert the returned payloads. I verified the loud failure by mutating the code: removing the exclusivity filter, hard-binding the query to a fixed tenant, and dropping the unknown-tenant rejection each fail three tests, including the service-level breach tests.
3. **The property holds end to end.** The breach tests run the real `OfferService` over the real `OfferRepository`, so the guarantee survives even if a future service path stops routing fetches through the tenant-isolated repository.
4. **Payloads leak nothing.** Mapped payloads strip `tenant_id` and `is_exclusive` — the boundary is enforced at the data layer, and consumers cannot re-introduce it.
5. **The known residual is anchored upstream.** The typestate prevents _unbound_ queries and the closed universe prevents _unknown-tenant_ values, but not _wrong-value_ bindings of a known tenant; the correctness of the tenantId is anchored by the identity handoff (designed below), which derives it from a verified token claim rather than a caller assertion. The issuer is the trust root — a stated assumption, not a silent one. When that handoff is built, its resolver targets this `TenantId` union, so an unrecognizable claim fails at the boundary instead of minting a phantom tenant.
6. **The exclusivity tenant is a single constant — the designated generalization seam.** With two tenants, policy-as-code is cheaper than policy-as-config; if partner-specific rules multiply, they move to tenant configuration (or the `is_exclusive` boolean becomes an `exclusiveTo: TenantId` field in the rows), not per-tenant forks. The starter kit is explicitly scoped to bootstrapping different services, never per-tenant clones.
7. **Offer expiry boundary is a pinned product decision:** an offer expiring exactly now is still valid (`expiresAt < Date.now()` is the failure test). Stated so Product can veto it.
8. **The tenant universe is closed, and exclusivity is whitelist-shaped.** The spec names exactly two tenants, so `TenantId` is the closed union `'tenant0' | 'switchback'` sealed in `tenant.ts`: an unknown or malformed tenant now fails closed (typed `InvalidTenantContextError` before any query is built) instead of returning an inert empty set — previously `WHERE tenant_id = '<typo>'` silently answered "no offers," which hid the fault. The guardrail itself was also corrected from a blacklist to a whitelist: the original shape only banned `tenant0` from exclusives, so an exclusivity row misfiled into some future tenant's partition would surface there; now the `is_exclusive` flag surfaces only for the tenant the exclusivity was negotiated for, and every other tenant (today `tenant0`) gets `is_exclusive = false` appended — the direction of the contract, not just today's instantiation of it. With two tenants the behavior is identical, so the change costs nothing and reads like the contract.

## The other two pieces — designed, not built

**Degraded-mode fallback.** The pricing/quoting dependency (Supply squad) would sit behind a port, never a reimplementation:

```ts
interface PricingDataSource {
  quoteOffers(context: TenantContext, offers: OfferPayload[]): Promise<OfferQuote[]>;
}
```

Policy: every surfaced offer needs a verified quote (rate + eligibility); on timeout (I would default to 250 ms) or failure, the service degrades to baseline offers at stored rates and never surfaces an exclusive offer it could not verify. The governing rule: pricing failures fail **safe** (return something safe), isolation failures fail **closed** (propagate; a wrong response is worse than none).

**SSO identity handoff.** Signature and token-expiry verification are the Enterprise API gateway's adapter, behind a port our tests mock:

```ts
interface IdentityTokenVerifier {
  verify(token: string): unknown;
}
```

Our side of the seam: validate claims structure (required `workerId`/`tenantId`), normalize the token into the internal context (`TenantContext` plus `workerId` plus tenure/region signals). Per the brief, the profile/eligibility signals ride in the claims bundle — there is no separate signals dependency to model.

## What I would harden next

- **Identity:** asymmetric keys (RS256/ES256) with JWKS and rotation, issuer/audience checks, replay protection, and the tenant-0 session adapter.
- **Pricing, once built:** circuit breaker with last-known-good quote caching, per-offer error granularity, and typed operational errors so degradation can distinguish timeout from protocol failure.
- **Transport and operations:** Fastify HTTP layer behind the Enterprise API gateway, offer-surface routing, structured error codes, audit logging on every exclusive-offer decision, New Relic instrumentation (dependency latency, degraded-mode rate, guardrail rejections), Rootly runbooks.
- **CI:** enforce the tiered coverage gate in the workflow (it currently runs via `npm run test:coverage`; CI runs `npm test`).

## How a teammate extends it

- **Onboard a tenant:** add it to the `TENANT_IDS` union in `tenant.ts`, then tenant-scoped data and breach tests for the new boundary — no code fork, no second deployment. Tenant-specific policy extends the policy seam (decision 6).
- **Add a dependency:** define an `XDataSource` port in `offer.types.ts`, inject it, mock it in specs, and state explicitly whether its failures fail safe or fail closed. Follow the pricing pattern.
- **Add a module:** colocate the spec (`*.spec.ts`), respect the coverage tiers (100% under `src/modules/**`), keep ports free of transport details.

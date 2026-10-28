# Switchback Offers Service

A multi-tenant offers service slice implementing tenant-scoped offer validation and retrieval, with tenant isolation enforced at the database/repository boundary.

## Table of Contents

- [About](#about)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running](#running)
- [Testing](#testing)
- [Linting and Formatting](#linting-and-formatting)
- [Project Structure](#project-structure)
- [Starter Kit](#starter-kit)
- [Architecture](#architecture)
- [API Reference](#api-reference)
- [Security](#security)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [FAQ](#faq)
- [License](#license)

## About

The Switchback Offers Service validates and retrieves promotional offers on behalf of tenants. Business rules (expiry, redemption limits) are evaluated in the service layer, while tenant isolation is enforced structurally in the repository layer so that no caller can query another tenant's offers.

## Features

- Offer validation against tenant context, expiry (`expiresAt`), and redemption limits (`currentRedemptions` vs. `maxRedemptions`).
- Repository-level tenant isolation: every query is automatically bound to the caller's `tenant_id`.
- Structural guardrail: tenant `tenant0` automatically receives an appended `is_exclusive = false` filter and can never receive Switchback-exclusive offers.
- Deterministic, dependency-injected design (service depends on an `OfferDataSource` port, not a concrete client).
- Full Vitest unit test suite covering validation rules, boundaries, and query-structure guardrails.

## Tech Stack

- Node.js (ESM)
- TypeScript (strict mode)
- Vitest

## Prerequisites

- Node.js (>= 26, pinned in `.nvmrc` and declared in `engines`) and npm
- A Git client

## Installation

```bash
git clone <repository-url>
cd switchback-project
npm install
```

## Configuration

TBD — no environment variables or external configuration are currently read by the code. Database connection details are expected to be provided by the injected `OfferDatabaseClient`.

## Running

Build and start:

```bash
npm run build
npm start
```

Or run directly in development mode:

```bash
npm run dev
```

The current entrypoint (`src/index.ts`) only logs an initialization message; the offer module is intended to be consumed programmatically (see [API Reference](#api-reference)).

## Testing

Run the full test suite once:

```bash
npm test
```

Run in watch mode:

```bash
npx vitest
```

Run a single spec file:

```bash
npx vitest run src/modules/offer/offer.service.spec.ts
```

Type-check without emitting:

```bash
npx tsc --noEmit
```

Run with the coverage gate:

```bash
npm run test:coverage
```

### Coverage policy

Coverage is gated in tiers (`vitest.config.ts`):

- `src/modules/**` (pure domain logic): 100% for statements, branches, functions, and lines.
- Global floor for everything else counted by the runner: 90%. I/O adapters, once introduced, are expected to live in this tier rather than under `src/modules/**`.

## Linting and Formatting

Run the linter:

```bash
npm run lint
```

Check formatting without writing:

```bash
npm run format:check
```

Rewrite files with formatting fixes:

```bash
npm run format
```

### Key decisions

- **`oxlint` is the linter.** It parses TypeScript natively (Rust implementation) and has no dependency on the `typescript` compiler package. `typescript-eslint` was evaluated first but hard-fails at runtime on this project's TypeScript 7 toolchain; `oxlint` is the substitution until typescript-eslint ships TypeScript 7 support, at which point it can be swapped back in `package.json` with no config changes elsewhere.
- **Formatting is delegated to `prettier`**, not the linter. Configuration lives in `.prettierrc` (single quotes, 100 print width, trailing commas) with `dist/`, `coverage/`, and `package-lock.json` excluded via `.prettierignore`. The linter therefore stays focused on correctness rules rather than style.
- **Unused variables and parameters must start with `_`** (for example a deliberately ignored mock parameter) to pass `no-unused-vars`. This is the repo-wide convention for signaling "intentionally not used".
- **CI enforces both** `npm run lint` and `npm run format:check` on every push to `main` and pull request (see `.github/workflows/ci.yml`).

## Project Structure

```
src/
├── index.ts                          # Entrypoint
└── modules/
    └── offer/
        ├── offer.types.ts            # Domain types (TenantContext, OfferPayload, ...)
        ├── offer.service.ts          # Business rules (validateOffer, getValidOffers)
        ├── offer.service.spec.ts     # Service unit tests
        ├── offer.repository.ts       # Tenant-isolated data access
        └── offer.repository.spec.ts  # Repository unit tests
starter-kit/
└── ...                               # Copy-ready toolchain scaffolding (see Starter Kit)
```

## Starter Kit

The engineering scaffolding this service was built on — strict TypeScript config, the Vitest setup with tiered coverage thresholds, lint/format tooling, CI workflow, and pinned Node version — is packaged under [`starter-kit/`](./starter-kit/README.md) as a copy-ready template for spinning up a new service with the same toolchain from day one. It is explicitly **not** a per-tenant template: the offers service is multi-tenant, so new tenants are onboarded into this service by adding tenant-scoped data, not by cloning separate services.

## Architecture

- **`OfferService`** — evaluates business rules only: tenant context presence, expiry, redemption limits. Fetches data exclusively through the `OfferDataSource` port.
- **`OfferRepository`** — implements `OfferDataSource`. Wraps the database client, always binds `.where('tenant_id', context.tenantId)`, and structurally appends `.andWhere('is_exclusive', false)` when the caller is `tenant0`. It refuses to execute any query without a valid `tenantId`.
- **Types** — `TenantContext`, `OfferPayload`, `OfferValidationResult`, `OfferDataSource` are the shared contracts between layers.

Validation failure reasons, in precedence order:

1. `Invalid tenant context`
2. `Offer has expired`
3. `Redemption limit reached`

The decision log for the built isolation slice — key tradeoffs, the designed-not-built pieces, what I would harden next, and how to extend the service — lives in [DECISIONS.md](./DECISIONS.md).

## API Reference

```ts
import { OfferService } from './src/modules/offer/offer.service.js';
import { OfferRepository } from './src/modules/offer/offer.repository.js';

const repository = new OfferRepository(dbClient);
const service = new OfferService(repository);

const result = service.validateOffer(tenantContext, offer); // OfferValidationResult
const offers = await service.getValidOffers(tenantContext); // OfferPayload[]
```

| Export                               | Signature                                                                | Description                                                                   |
| ------------------------------------ | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| `OfferService.validateOffer`         | `(context: TenantContext, offer: OfferPayload) => OfferValidationResult` | Synchronous rule evaluation                                                   |
| `OfferService.getValidOffers`        | `(context: TenantContext) => Promise<OfferPayload[]>`                    | Fetches tenant-scoped offers via the repository and filters by business rules |
| `OfferRepository.findOffersByTenant` | `(context: TenantContext) => Promise<OfferPayload[]>`                    | Tenant-isolated query with the `tenant0` exclusive-offer guardrail            |

## Security

- Tenant isolation is enforced at the repository boundary: queries are bound to the caller's `tenant_id` and cannot be constructed without a valid tenant context.
- `tenant0` is structurally restricted from Switchback-exclusive offers at query construction time.
- Reporting vulnerabilities: TBD (contact/process to be defined).

## Roadmap

TBD

## Contributing

TBD

## FAQ

TBD

## License

ISC (per `package.json`); see the `LICENSE` file.

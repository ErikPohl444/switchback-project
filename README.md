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
- [Project Structure](#project-structure)
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

- Node.js and npm (minimum supported versions: TBD)
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
```

## Architecture

- **`OfferService`** — evaluates business rules only: tenant context presence, expiry, redemption limits. Fetches data exclusively through the `OfferDataSource` port.
- **`OfferRepository`** — implements `OfferDataSource`. Wraps the database client, always binds `.where('tenant_id', context.tenantId)`, and structurally appends `.andWhere('is_exclusive', false)` when the caller is `tenant0`. It refuses to execute any query without a valid `tenantId`.
- **Types** — `TenantContext`, `OfferPayload`, `OfferValidationResult`, `OfferDataSource` are the shared contracts between layers.

Validation failure reasons, in precedence order:

1. `Invalid tenant context`
2. `Offer has expired`
3. `Redemption limit reached`

## API Reference

```ts
import { OfferService } from './src/modules/offer/offer.service.js';
import { OfferRepository } from './src/modules/offer/offer.repository.js';

const repository = new OfferRepository(dbClient);
const service = new OfferService(repository);

const result = service.validateOffer(tenantContext, offer); // OfferValidationResult
const offers = await service.getValidOffers(tenantContext); // OfferPayload[]
```

| Export | Signature | Description |
| --- | --- | --- |
| `OfferService.validateOffer` | `(context: TenantContext, offer: OfferPayload) => OfferValidationResult` | Synchronous rule evaluation |
| `OfferService.getValidOffers` | `(context: TenantContext) => Promise<OfferPayload[]>` | Fetches tenant-scoped offers via the repository and filters by business rules |
| `OfferRepository.findOffersByTenant` | `(context: TenantContext) => Promise<OfferPayload[]>` | Tenant-isolated query with the `tenant0` exclusive-offer guardrail |

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

ISC (per `package.json`); a `LICENSE` file has not yet been added.

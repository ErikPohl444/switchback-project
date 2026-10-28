# Starter Kit

This repository doubles as a starter kit: the engineering scaffolding that this service was built on — strict TypeScript, ESM, tiered test coverage, linting/formatting, and CI — is packaged here as a copy-ready template for spinning up a new service.

## When to use this kit — and when not to

**Onboarding a new tenant to the offers service is not a use case for this kit.** The offers service is multi-tenant by design: every repository query is bound to the caller's `tenant_id` at the repository boundary, so a new tenant is onboarded by adding tenant-scoped data — no code fork, no second service, no second deployment. Cloning this repository per tenant would duplicate business logic and undermine the single-source-of-truth that tenant isolation exists to protect. The only tenant-specific piece in the codebase today is the `tenant0` exclusive-offer guardrail (`src/modules/offer/offer.repository.ts`), a single code-level constant; if tenant-specific policies multiply, they belong in tenant configuration, not in per-tenant forks.

Use this kit only to bootstrap a **different kind of service** that should share the same engineering recipe (strict TypeScript, tiered coverage, lint/format gates, CI).

## What's included

| File                       | Purpose                                                                    |
| -------------------------- | -------------------------------------------------------------------------- |
| `package.json`             | Build/dev/test/lint/format/typecheck scripts and the pinned toolchain      |
| `tsconfig.json`            | Strict-mode TypeScript targeting ES2022 with `NodeNext` module resolution  |
| `vitest.config.ts`         | Vitest setup with tiered coverage thresholds (100% under `src/modules/**`) |
| `.github/workflows/ci.yml` | GitHub Actions workflow running lint, format check, tests, and typecheck   |
| `.prettierrc`              | Prettier config (single quotes, 100 print width, trailing commas)          |
| `.prettierignore`          | Formatter exclusions for `dist/`, `coverage/`, and `package-lock.json`     |
| `.gitignore`               | Dependency, build, coverage, and environment file exclusions               |
| `.nvmrc`                   | Pinned Node version                                                        |
| `.npmrc`                   | npm behavior settings                                                      |

## Scaffolding a different service from this toolchain

1. Copy the contents of this folder to the root of your new repository.
2. Rename the package in `package.json` (`name`, `description`, `author`).
3. Run `npm install`.
4. Drop your domain code under `src/modules/<module>/` following the structure documented in the [main README](../README.md#project-structure).

The scripts and CI workflow work unchanged: `npm run lint`, `npm run format:check`, `npm test`, and `npm run typecheck` are the same gates enforced on every push and pull request.

## Rationale

The starter kit encodes decisions made during this project's development:

- **oxlint over typescript-eslint** — parses TypeScript natively without depending on the `typescript` compiler package (typescript-eslint was incompatible with the TypeScript 7 toolchain at build time; it can be swapped back without config changes elsewhere).
- **Formatting delegated to Prettier**, keeping the linter focused on correctness rather than style.
- **Tiered coverage thresholds** — 100% for pure domain modules under `src/modules/**`, a 90% global floor elsewhere, so I/O adapters are not held to domain-grade standards.

See the main README's [Linting and Formatting](../README.md#linting-and-formatting) section for the full decision log.

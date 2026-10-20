# ALX Application Adapters Guide

The root [`AGENTS.md`](../AGENTS.md) remains applicable. This guide governs every file under `adapters/`.

## Scope and role

`@alx-protocol/adapters` is an optional, non-normative application package for local Block persistence. It currently provides the `BlockStore` interface plus memory, browser IndexedDB, and filesystem implementations.

Storage changes Block availability only. A store is not a Graph, does not discover relationships, and must not redefine Block or Graph validity.

## Governing sources

Use these sources in order for adapter work:

1. [`../protocol/spec.md`](../protocol/spec.md), [`../protocol/schemas/`](../protocol/schemas/), and [`../protocol/error-codes.json`](../protocol/error-codes.json) for protocol behavior.
2. [`../sdk/`](../sdk/) for the TypeScript Block type, normalization, parsing, and validation APIs.
3. [`README.md`](README.md) and [`package.json`](package.json) for the published adapter surface.
4. [`../tests/integration/adapters/`](../tests/integration/adapters/) for executable adapter contracts.

Do not encode new protocol behavior in an adapter to compensate for an unclear canonical rule. Stop and resolve the authority conflict first.

## Local invariants

- Accept and return the SDK's `Block` type; do not create a competing Block representation.
- Validate Blocks before persistence and after deserialization.
- Normalize Block-hash lookup keys through the SDK. Never use `contentHash` as a Block key.
- Preserve the complete Block value. Do not mutate caller-owned or stored objects through returned references.
- `get` returns `null` for an absent valid key. Invalid keys and malformed stored data remain errors.
- `list` returns deterministic, ascending `blockHash` order and summaries that identify `protocolVersion`.
- Implementations of `put`, `get`, `list`, `has`, and `remove` must have equivalent observable semantics across stores.
- Filesystem input must use strict JSON ingress. Atomic replacement and cleanup behavior must remain safe under failures.
- Browser-only dependencies must not leak into the default or filesystem export.
- Persistence, replication, indexing, authorization, encryption, retention, and backup policy remain application responsibilities.

## Change rules

- Keep changes inside `adapters/` and its integration tests unless an SDK or protocol defect is independently established.
- A public export or `BlockStore` signature change requires README, type declarations, package exports, and integration tests to change together.
- Add a shared contract test when behavior must hold for every store; add a store-specific test only for backend-specific behavior.
- Do not weaken validation merely to accept corrupt legacy data.
- Do not add network services, credentials, or environment-dependent integration tests to the default adapter test command.
- Treat destructive filesystem behavior, path construction, and concurrency changes as security-sensitive.

## Verification

Run from the repository root:

```bash
pnpm run test:adapters
pnpm --filter @alx-protocol/adapters run typecheck
pnpm run format:check
```

Also run `pnpm run test:unit` when SDK validation or normalization usage changes. Run `pnpm run verify:protocol` only when canonical protocol sources or protocol-visible behavior change.

## Stop conditions

Stop and request direction if:

- correct adapter behavior would conflict with the SDK and canonical protocol sources;
- a change would make storage presence, ordering, or metadata part of protocol validity;
- a migration would overwrite or delete user data without explicit authorization and a recovery path;
- tests require real credentials, external services, or an unavailable browser environment;
- a public API break was not explicitly authorized.

## Completion evidence

In addition to the root completion report, identify affected stores, public API changes, data-migration impact, and whether any backend-specific verification was omitted.

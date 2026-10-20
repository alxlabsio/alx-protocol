# TypeScript SDK Guide

The root [`AGENTS.md`](../AGENTS.md) remains applicable. This guide governs `sdk/`.

## Role and authority

`@alx-protocol/sdk` is the primary TypeScript implementation and public package. It implements canonical behavior but does not define it. Resolve protocol behavior through the canonical sources before editing implementation code.

## Local invariants

- Keep canonicalization, hashing, Block validation, Graph verification, and Trace logic deterministic, pure, offline, and independent of ambient time/randomness.
- Preserve strict raw JSON ingress before decoded ALX values.
- Preserve five-field Blocks and strict parent normalization.
- New Graph verification code uses `validateGraph(seed, source, context)` and complete `GraphVerification` results.
- Keep adjacency overloads and convenience helpers clearly classified as compatibility APIs.
- Keep `pathCount` exact and serialized as decimal text.
- Keep signing, Merkle, replay, middleware, and application helpers outside core conformance unless selected by an explicit extension suite.
- Use typed canonical error identifiers; do not make human-readable messages portable output.
- Avoid mutation of caller-owned Blocks, arrays, maps, or contexts unless the API explicitly documents it.
- No core operation requires storage, a network, ALX Labs infrastructure, credentials, or optional peer dependencies.

## Public API changes

- Update `src/index.ts`, subpath exports, type declarations, package README/API guide, and tests together.
- Preserve existing behavior unless a breaking package change is authorized.
- Add overloads only when result and error semantics remain unambiguous.
- Lazy-load optional cryptographic dependencies and fail with a clear package-layer error when unavailable.
- Do not broaden accepted protocol inputs for ergonomic reasons; adapters may perform explicit conversion before calling core functions.

## Tests

Place executable tests under the repository `tests/` taxonomy. Add canonical vectors only for protocol requirements, not SDK-only helpers. Add native tests for values the JSON conformance adapter cannot transport.

From the repository root:

```bash
pnpm --filter @alx-protocol/sdk run build
pnpm --filter @alx-protocol/sdk run typecheck
pnpm run test:unit
pnpm run test:security
pnpm run test:conformance:ts
pnpm run format:check
```

Run `pnpm run verify:cross-language` for protocol-visible behavior and `pnpm run test:extension` for shared extension behavior. Use coverage/fuzz/mutation gates when the risk justifies them.

## Stop conditions

Stop if SDK behavior would conflict with canonical sources, a compatibility helper would be mistaken for canonical output, a public break lacks authorization, deterministic behavior would depend on environment/network/time, or optional dependencies would become core requirements.

## Completion evidence

Report exports/types affected, compatibility impact, canonical authority, tests and conformance results, optional dependency behavior, protocol-visible impact, and omitted gates.

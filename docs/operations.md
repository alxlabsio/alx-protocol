# ALX Operation Map

**Document type:** Reference

This page separates canonical conformance operations from TypeScript compatibility helpers, optional extension operations, and application utilities. Exact protocol behavior remains defined by [`../protocol/spec.md`](../protocol/spec.md), canonical schemas, vectors, and error identifiers.

## Canonical operation surface

Portable conformance operation names are discovered through [`../protocol/suites.json`](../protocol/suites.json). The maintained TypeScript entry point may use a package-specific function name while preserving the same canonical behavior.

| Concern | Portable operation | TypeScript surface | Governing source |
|---|---|---|---|
| Canonicalization | `canonicalize` | `canonicalizeProtocolJson` | [Specification section 2](../protocol/spec.md#2-canonicalization) |
| Raw JSON ingress | `decodeRawJson` | `parseStrictJson`, `parseStrictJsonBytes` | [Specification section 2](../protocol/spec.md#2-canonicalization), raw-ingress vectors |
| Block identity | `deriveBlockHash`, `deriveContentHash`, `createBlock` | Same names | [Specification section 3](../protocol/spec.md#3-identity) |
| Block validation | `validateBlock` | `validateBlock` | [`block.schema.json`](../protocol/schemas/block.schema.json), Block vectors |
| Parent normalization | `normalizeHashes` | `normalizeHashes` | [Specification section 4](../protocol/spec.md#4-lineage), parent vectors |
| Lineage checks | `validateLineage` | `validateLineage` | [Specification section 4](../protocol/spec.md#4-lineage), lineage vectors |
| Graph verification | `validateGraph` | `validateGraph(seed, source, context)` | [`graph-validation-request.schema.json`](../protocol/schemas/graph-validation-request.schema.json), Graph vectors |
| Trace construction | `traceAttribution` | `traceAttribution` | [Specification section 5](../protocol/spec.md#5-attribution-trace), Trace vectors |
| Trace verification | `verifyTrace` | `verifyTrace` | [Specification section 5](../protocol/spec.md#5-attribution-trace) |

The runner interface and complete portable request/response contract are documented in [`../conformance/README.md`](../conformance/README.md). Canonical expected results live in [`../test-vectors/`](../test-vectors/); this page is not a substitute for them.

## Canonical Graph verification

The current operation accepts three distinct inputs:

```ts
validateGraph(seed, source, context)
```

- `seed` is the root Block supplied separately from the source.
- `source` resolves reachable Block identities; the portable encoding uses a finite order-independent candidate collection.
- `context` identifies `graphRoot`, validation mode, scope boundaries, and resource limits.

The complete result is a `GraphVerification` with `checked: true` and one of `valid`, `invalid`, `incomplete`, or `resource_limit_reached`. The deprecated adjacency-only overload is not the canonical Graph-verification request or result model.

## TypeScript compatibility and convenience helpers

These exported SDK helpers are not separate canonical protocol operations:

| Helper | Classification |
|---|---|
| `normalizeHash`, `normalizeHashLenient` | Hash parsing utilities |
| `sanitizeImportedParentHashes` | Diagnostic import-boundary utility; callers still select policy |
| `validateGraphStructure` | Adjacency-only compatibility API |
| `validateGraph(graph, context?)` | Deprecated adjacency overload |
| `buildGraph` | In-memory adjacency construction |
| `verifyGraph` | Compatibility helper for a supplied Block collection and hash callback |
| `addBlockToGraph`, `validateIncrementalBlock` | Incremental in-memory SDK helpers |
| `lock` | SDK object-handling convenience |

Documentation and new integrations should use the canonical three-argument `validateGraph` form when making a Graph verification claim.

## Optional extension operations

| Extension | Operations | Authority |
|---|---|---|
| Merkle | `buildMerkleTree`, `getMerkleProof`, `verifyMerkleProof` | [`../protocol/extensions/merkle/`](../protocol/extensions/merkle/) |
| Portable signing | `createSignedBlock`, `addAttestation`, `validateSignedBlock`, Ed25519 and P-256 signer/verifier backends | [`../protocol/extensions/signing/`](../protocol/extensions/signing/) |
| Content profile | Schema validation selected by the application | [`../protocol/extensions/content-profile/`](../protocol/extensions/content-profile/) |

Extension support is additive and never required for core conformance.

## Application and legacy signing utilities

The TypeScript SDK also exports EIP-712, signed-request, replay-window, and middleware helpers. These are package/application capabilities, not core ALX operations and not part of the portable signing-extension suites. Their behavior is governed by the SDK API and application policy.

Examples include `signBlock`, `verifyBlockSignature`, `buildProtocolSigningDomain`, `verifySignedProtocolPayload`, `buildReplayScopeKey`, `validateReplayWindow`, and the separate middleware entry point.

## Related documents

- [`../CONFORMANCE.md`](../CONFORMANCE.md) — conformance claim model
- [`data-model.md`](./data-model.md) — canonical structure map
- [`integrators/api-reference.md`](./integrators/api-reference.md) — TypeScript SDK reference
- [`../sdk/README.md`](../sdk/README.md) — package entry point

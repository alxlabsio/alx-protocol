# ALX Data-Structure Map

**Document type:** Reference

This page maps ALX structures to their canonical schemas and prose. It does not duplicate field constraints or define protocol behavior.

## Canonical structures

| Structure | Purpose | Canonical source |
|---|---|---|
| Block | Sole ALX protocol primitive | [`block.schema.json`](../protocol/schemas/block.schema.json), [specification section 1](../protocol/spec.md#1-primitive) |
| ALX value | Value model accepted by canonicalization | [specification section 2](../protocol/spec.md#2-canonicalization) |
| Verification Context | Scope, root, mode, limits, and declared external boundaries for verification | [`verification-context.schema.json`](../protocol/schemas/verification-context.schema.json), [specification section 4](../protocol/spec.md#4-lineage) |
| Graph validation request | Portable seed, finite Block source, and context encoding | [`graph-validation-request.schema.json`](../protocol/schemas/graph-validation-request.schema.json) |
| Graph verification | Complete checked Graph result | [`graph-verification.schema.json`](../protocol/schemas/graph-verification.schema.json), [specification section 4](../protocol/spec.md#4-lineage) |
| Attribution Trace | Deterministic structural Trace rooted at an available Block | [`attribution-trace.schema.json`](../protocol/schemas/attribution-trace.schema.json), [specification section 5](../protocol/spec.md#5-attribution-trace) |
| Verification Receipt | Record of one verification context and result | [`verification-receipt.schema.json`](../protocol/schemas/verification-receipt.schema.json) |
| Core error registry | Canonical language-neutral error identifiers | [`error-codes.json`](../protocol/error-codes.json) |

## Conformance structures

| Structure | Purpose | Canonical source |
|---|---|---|
| Suite manifest | Required suite discovery and comparison metadata | [`suite-manifest.schema.json`](../protocol/schemas/suite-manifest.schema.json), [`suites.json`](../protocol/suites.json) |
| Test-vector file | Language-neutral inputs and expected results | [`test-vector.schema.json`](../protocol/schemas/test-vector.schema.json), [`test-vectors/`](../test-vectors/) |
| Expected result | Operation-specific conformance result shapes | [`expected-results.schema.json`](../protocol/schemas/expected-results.schema.json) |
| Error-code registry | Shape of core and extension error registries | [`error-code-registry.schema.json`](../protocol/schemas/error-code-registry.schema.json) |

## Optional extension structures

| Structure | Boundary | Source |
|---|---|---|
| Content Envelope | Optional content profile inside `Block.content` | [`content-envelope.schema.json`](../protocol/schemas/content-envelope.schema.json), [`content-profile/`](../protocol/extensions/content-profile/) |
| Signed Block | Optional attestation envelope; excluded from core Block identity | [`signed-block.schema.json`](../protocol/extensions/signing/schemas/signed-block.schema.json), [`signing/`](../protocol/extensions/signing/) |
| Merkle proof | Optional checkpoint inclusion proof | [`merkle-proof.schema.json`](../protocol/extensions/merkle/schemas/merkle-proof.schema.json), [`merkle/`](../protocol/extensions/merkle/) |
| Extension manifest | Lifecycle and compatibility metadata for an optional extension | [`extension-manifest.schema.json`](../protocol/schemas/extension-manifest.schema.json) |

## Important distinctions

- `contentHash` identifies canonicalized `content`; `blockHash` identifies canonicalized `content` together with normalized `parentHashes`.
- `parentHashes` contains declared direct parents. Reverse child indexes are derived application data.
- Block validation and Graph verification are separate claims.
- `incomplete` means required Block data was unavailable; `resource_limit_reached` means processing stopped because a budget was exhausted. Neither means `invalid` without an independent violation.
- `pathCount` is an exact structural count serialized as decimal digits. It has no protocol-defined economic or authorship meaning.
- Storage rows, database indexes, API envelopes, Explorer neighborhoods, and XNDR records are application structures, not protocol structures.

## Related documents

- [`../SPECIFICATION.md`](../SPECIFICATION.md) — canonical-source map
- [`operations.md`](./operations.md) — operation and API classification map
- [`../GLOSSARY.md`](../GLOSSARY.md) — terminology index
- [`../GRAPH.md`](../GRAPH.md) — focused Graph and Trace reference

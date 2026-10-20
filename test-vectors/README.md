# Test Vectors

Language-agnostic canonical input/output pairs for **core** ALX Protocol conformance testing.

The vectors are deliberately separate from executable tests and repository scripts:

```text
test-vectors/  normative language-neutral data
tests/         executable test code
scripts/       repository operations and verification tooling
```

## Manifest

[`../protocol/suites.json`](../protocol/suites.json) is the single canonical discovery entry point. It declares each suite's path, operation, execution model, comparison mode, vector count, vector and expected-result schema identifiers, required status, and SHA-256 digest.

## Files

| File | Suite | Description |
|---|---|---|
| [`canonicalization/canonicalization.json`](canonicalization/canonicalization.json) | Canonicalization | `recursive-json-sort-v1` serialization |
| [`canonicalization/canonicalization-depth.json`](canonicalization/canonicalization-depth.json) | Canonicalization depth | normative recursion-depth boundary |
| [`canonicalization/canonicalization-negative.json`](canonicalization/canonicalization-negative.json) | Canonicalization rejection | invalid canonical inputs |
| [`identity/block-identity.json`](identity/block-identity.json) | Block identity | `createBlock`, `deriveBlockHash`, parent normalization |
| [`ingress/raw-json.json`](ingress/raw-json.json) | Raw JSON ingress | fatal UTF-8 decoding, JSON syntax, duplicate-member, and trailing-data rejection before ALX value processing |
| [`blocks/parent-normalization.json`](blocks/parent-normalization.json) | Parent normalization | fail-closed collection and entry validation, normalization, deduplication, and sorting |
| [`blocks/parent-limits.json`](blocks/parent-limits.json) | Parent limits | normative `MAX_PARENTS = 256` boundary |
| [`graphs/attribution-trace.json`](graphs/attribution-trace.json) | Attribution | `traceAttribution` lineage resolution |
| [`graphs/trace-boundaries.json`](graphs/trace-boundaries.json) | Trace boundaries | root-request and malformed Graph-key rejection |
| [`graphs/lineage-negative.json`](graphs/lineage-negative.json) | Lineage | invalid Graph and parent cases |
| [`graphs/lineage-boundaries.json`](graphs/lineage-boundaries.json) | Lineage boundaries | partial availability and out-of-order arrival |
| [`graphs/graph-validation-outcomes.json`](graphs/graph-validation-outcomes.json) | Graph validation outcomes | statuses, precedence, availability, scope, resource boundaries, and `checked: false` |
| [`graphs/graph-validation-interactions.json`](graphs/graph-validation-interactions.json) | Graph validation interactions | depth-plus-one, precedence combinations, ordering, invalid parents, and request-root failures |
| [`graphs/semantic-validity.json`](graphs/semantic-validity.json) | Semantic validity | protocol-invalid cases with schema-valid shape |
| [`graphs/semantic-integrity.json`](graphs/semantic-integrity.json) | Semantic integrity | Trace and Graph authenticity checks |

Optional extensions keep their vectors outside the core directory:

| Extension | Location |
|---|---|
| Merkle | [`../protocol/extensions/merkle/test-vectors/`](../protocol/extensions/merkle/test-vectors/) |
| Signing | [`../protocol/extensions/signing/test-vectors/`](../protocol/extensions/signing/test-vectors/) |

Machine-readable normative suite discovery is defined in [`../protocol/suites.json`](../protocol/suites.json).

The security-hardening decision and vector implementation status are recorded in [`../docs/decisions/010-security-boundary-contract.md`](../docs/decisions/010-security-boundary-contract.md). Cases marked executable are canonical authority in the applicable suite files.

Core suite files declare the stable identifier `https://alxprotocol.com/protocol/1/schemas/test-vector.schema.json`. Repository tooling resolves that identifier offline to [`../protocol/schemas/test-vector.schema.json`](../protocol/schemas/test-vector.schema.json).

Expected values are also validated offline against the operation-specific definitions in [`../protocol/schemas/expected-results.schema.json`](../protocol/schemas/expected-results.schema.json). This prevents a result field from being accepted merely because it is valid for some unrelated operation.

Raw ingress vectors encode serialized bytes as hexadecimal. They are not decoded ALX-value inputs and do not treat malformed byte streams as ordinary JSON values.

`validateGraph` vectors encode the normative `seed`, finite Block `source`, and verification `context` request using [`../protocol/schemas/graph-validation-request.schema.json`](../protocol/schemas/graph-validation-request.schema.json). The finite source preserves duplicate candidates and source ordering is non-normative. Successful checked operations require the complete [`graph-verification.schema.json`](../protocol/schemas/graph-verification.schema.json) envelope and exact comparison. Canonical Graph issues contain only `code` and attributed `blockHash`; localized messages are outside the result.

## Format

Each file contains:

```json
{
  "suite": "suite-name",
  "description": "What this suite tests",
  "vectors": [
    {
      "id": "XX",
      "description": "Human-readable name",
      "comparison": "semantic",
      "input": "...",
      "expected": "..."
    }
  ]
}
```

## Consuming Vectors

SDKs and implementations load core vectors from this directory and assert their outputs match the expected values.

- **TypeScript SDK**: `conformance/bin/run.js`
- **Python**: `reference-implementations/python/tests/test_vectors.py`
- **Rust**: `reference-implementations/rust/src/`

## Adding Vectors

1. Add the vector to the appropriate JSON file
2. Run `pnpm run protocol:checksums:write` to refresh manifest counts and digests
3. Ensure all implementations claiming support for that suite produce the required outputs

Adding a required suite with an existing `executionModel` requires only a manifest entry and suite file; the conformance runner does not maintain a second suite-ID registry.

The `assertions` and `note` fields are informative metadata. Conformance decisions depend only on structured inputs, comparison mode, and expected-result fields. A vector-level `comparison` overrides the suite default.

## Related Documents

- [Protocol specification](../protocol/spec.md)
- [Conformance suite registry](../protocol/suites.json)
- [Protocol schemas](../protocol/schemas/)

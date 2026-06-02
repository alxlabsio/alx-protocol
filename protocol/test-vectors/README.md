# Test Vectors

Language-agnostic canonical input/output pairs for **core** ALX Protocol conformance testing.

## Files

| File | Suite | Description |
|---|---|---|
| [`canonicalization.json`](canonicalization.json) | Canonicalization | `recursive-json-sort-v1` serialization |
| [`canonicalization-depth.json`](canonicalization-depth.json) | Canonicalization depth | normative recursion-depth boundary |
| [`block-identity.json`](block-identity.json) | Block Identity | `createBlock`, `deriveBlockHash`, parent normalization |
| [`attribution-trace.json`](attribution-trace.json) | Attribution | `traceAttribution` lineage resolution |
| [`lineage-negative.json`](lineage-negative.json) | Lineage | invalid graph and parent cases |
| [`lineage-boundaries.json`](lineage-boundaries.json) | Lineage boundaries | partial availability and out-of-order arrival |
| [`canonicalization-negative.json`](canonicalization-negative.json) | Canonicalization (rejection) | invalid canonical inputs |
| [`parent-limits.json`](parent-limits.json) | Parent limits | normative `MAX_PARENTS = 256` boundary |
| [`semantic-validity.json`](semantic-validity.json) | Semantic validity | protocol-invalid cases with schema-valid shape |
| [`semantic-integrity.json`](semantic-integrity.json) | Semantic integrity | Trace and Graph authenticity checks |

Optional extensions keep their vectors outside the core directory:

| Extension | Location |
|---|---|
| Merkle | [`../extensions/merkle/test-vectors/`](../extensions/merkle/test-vectors/) |
| Signing | [`../extensions/signing/test-vectors/`](../extensions/signing/test-vectors/) |
| IPFS artifact package | [`../extensions/ipfs-artifact-package/test-vectors/`](../extensions/ipfs-artifact-package/test-vectors/) |

Machine-readable suite discovery is defined in [`../suites.json`](../suites.json).

Core suite files SHOULD declare `"$schema": "../schemas/test-vector.schema.json"`. Structural validation uses [`../schemas/test-vector.schema.json`](../schemas/test-vector.schema.json).

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
      "input": "...",
      "expected": "..."
    }
  ]
}
```

## Consuming Vectors

SDKs and implementations load core vectors from this directory and assert their outputs match the expected values.

- **TypeScript SDK**: `sdk/src/__tests__/conformance-vectors.test.js`
- **Python**: `reference-implementations/python/tests/test_vectors.py`
- **Rust**: `reference-implementations/rust/src/`

## Adding Vectors

1. Add the vector to the appropriate JSON file
2. Update all SDK/implementation test runners to cover the new vector
3. Ensure all implementations claiming support for that suite produce byte-identical outputs

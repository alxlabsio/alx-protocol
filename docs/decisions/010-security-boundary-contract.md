# ADR-010: Security Boundary Contract

This decision defines the prerelease v1 behavior required to remediate the Graph, Trace, raw-input, resource-limit, and attestation findings identified during the internal adversarial review.

## Decision

### Graph Input

Graph keys and parent references are validated and normalized before traversal. Malformed hashes, normalized key collisions, and duplicate normalized parents produce `invalid` without traversal. Unsupported validation modes are malformed context and are rejected before a checked Graph result is produced.

Graph diagnostic collections use deterministic normalized-hash ordering.

### Known Block Sets

An omitted optional known-Block set does not make a parent-resolution claim. An explicitly supplied empty set states that no Block is known. Collection truthiness does not alter these semantics.

### Trace Roots

A Trace root is a resolved member of the supplied Graph. Open-world validation permits unresolved parent boundaries but does not permit an unresolved root. Trace construction fails when the root is omitted, malformed, or absent.

### Raw JSON Input

Core canonicalization consumes an ALX value. An implementation that accepts raw JSON text decodes UTF-8 without replacement and rejects duplicate object names, malformed JSON, and trailing data before constructing that value.

### Operational Limits

Implementation resource budgets do not change protocol validity. Budget exhaustion produces `resource_limit_reached` unless a known protocol violation takes precedence. It produces no partial result represented as `valid`.

### Portable Attestations

A portable attestation authenticates its exact Block-attestation payload. It does not establish authorization, ownership, legal identity, content truth, timestamp freshness, uniqueness, quorum weight, or application permission.

## Error Mapping

| Condition | Required core error |
|---|---|
| Malformed Graph key, parent, or Trace root | `ALX_INVALID_HASH` |
| Normalization-colliding Graph keys | `ALX_DUPLICATE_BLOCK` |
| Duplicate normalized parents | `ALX_DUPLICATE_PARENT` |
| Unsupported validation mode | `ALX_INVALID_GRAPH` |
| Omitted Trace root | `ALX_ROOT_HASH_REQUIRED` |
| Valid Trace root absent from supplied Graph | `ALX_GRAPH_ROOT_NOT_FOUND` |
| Supplied Trace object omits its root node | `ALX_TRACE_ROOT_MISSING` |
| Invalid raw JSON or invalid UTF-8 reported with a core identifier | `ALX_SCHEMA_INVALID` |
| Required syntactically valid parent unavailable | `ALX_MISSING_PARENT` availability diagnostic; `incomplete` unless a higher-precedence outcome applies |
| Operational budget exhaustion | `resource_limit_reached`; no protocol-invalid claim |

No error identifier is added, removed, or repurposed by this decision.

## Conformance Vector Status

| ID | Suite | Behavior | Status |
|---|---|---|---|
| `LB7` | lineage boundaries | omitted known set does not claim resolution | Executable |
| `LB8` | lineage boundaries | explicit empty known set reports every parent unresolved | Executable |
| `LB9` | lineage boundaries | populated known set resolves only included hashes | Executable |
| `SI9` | semantic integrity | malformed Graph key fails with `ALX_INVALID_HASH` | Executable |
| `SI10` | semantic integrity | normalization-colliding Graph keys fail with `ALX_DUPLICATE_BLOCK` | Executable |
| `SI11` | semantic integrity | invalid Graph mode fails with `ALX_INVALID_GRAPH` | Executable |
| `SI12` | semantic integrity | Graph diagnostics use normalized Block-hash order | Executable |
| `T14` | attribution trace | absent valid root fails with `ALX_GRAPH_ROOT_NOT_FOUND` | Executable |
| `T15` | attribution trace | malformed root fails with `ALX_INVALID_HASH` | Executable |
| `T16` | attribution trace | open-world mode does not permit an absent root | Executable |
| `T17` | attribution trace | present root produces the existing deterministic result | Executable |
| `RJ1` | raw-input security | duplicate object member is rejected before canonicalization | Executable |
| `RJ2` | raw-input security | malformed UTF-8 is rejected without replacement | Executable |
| `RJ3` | raw-input security | trailing non-whitespace data is rejected | Executable |
| `RJ4` | raw-input security | valid UTF-8 JSON produces the same ALX value through every adapter | Executable |
| `OP1` | operational security | budget exhaustion returns `resource_limit_reached`, never `invalid` by itself | Executable |
| `SA1` | signing extension | replayed identical attestation has no additional protocol weight | Executable |

Raw-input and operational vectors require runner support because duplicate JSON members and malformed UTF-8 cannot be represented as ordinary parsed JSON vector values.

## Compatibility

This decision changes Graph, lineage, and Trace rejection behavior for inputs that current implementations accept inconsistently or contrary to existing fail-closed requirements. It does not change canonicalization output for valid ALX values, `contentHash`, `blockHash`, normalized `parentHashes`, valid Trace output, or extension signature bytes.

These corrections were incorporated into the ALX Protocol v1 release target without changing `protocol/VERSION`. TypeScript, Python, and Rust were updated together and pass the applicable conformance and security gates. Public release status remains governed by [`../../PUBLICATION.md`](../../PUBLICATION.md).

## Implementation Order

1. Graph and lineage validation
2. AttributionTrace integrity
3. Strict raw-input boundaries
4. Persistent-state validation
5. Operational resource budgets
6. Signing and Merkle hardening
7. Supply-chain and audit evidence

## Related Documents

- [`../../protocol/spec.md`](../../protocol/spec.md)
- [`../../protocol/error-codes.json`](../../protocol/error-codes.json)
- [`../../test-vectors/README.md`](../../test-vectors/README.md)
- [`../governance/independent-security-review-plan.md`](../governance/independent-security-review-plan.md)
- [`../governance/security-review-status.md`](../governance/security-review-status.md)

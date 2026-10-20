# Language Implementation Guide

**Document type:** Guide

This guide describes a safe implementation sequence for ALX v1. It is not a second specification. Resolve every behavioral detail against [`../../protocol/spec.md`](../../protocol/spec.md), canonical schemas, vectors, and error identifiers.

## Before implementation

Read these sources in order:

1. [`../../SPECIFICATION.md`](../../SPECIFICATION.md) — authority map;
2. [`../../protocol/spec.md`](../../protocol/spec.md) — normative prose;
3. [`../../protocol/schemas/`](../../protocol/schemas/) — canonical structures;
4. [`../../protocol/suites.json`](../../protocol/suites.json) — required suite discovery;
5. [`../../test-vectors/`](../../test-vectors/) — canonical inputs and results; and
6. [`../../protocol/error-codes.json`](../../protocol/error-codes.json) — exact core identifiers.

Do not use the TypeScript SDK as the protocol oracle. It is maintained evidence and a useful comparison target, but canonical sources govern disagreements.

## Recommended implementation sequence

### 1. Define the ALX value boundary

Represent only the value types accepted by specification section 2. Reject unsupported language-native values before or during canonicalization. Preserve the distinction between direct in-memory values and raw JSON ingress.

Raw JSON adapters reject malformed UTF-8, duplicate member names at every depth, and trailing non-whitespace input before constructing an ALX value. A parser that has already discarded duplicates cannot claim to have validated this boundary.

### 2. Implement canonicalization

Canonicalization must match the exact vector bytes. High-risk areas are:

- UTF-16 code-unit ordering for object keys;
- shortest JSON-compatible IEEE-754 number rendering;
- canonical `-0` handling;
- rejection of non-finite numbers and unsafe integers;
- rejection of unsupported or cyclic values;
- unpaired-surrogate rejection; and
- the inclusive depth definition and limit.

Use the canonicalization, negative, depth, raw-ingress, and Unicode boundary vectors. Language standard-library JSON output is not sufficient evidence by itself.

### 3. Implement typed hash domains

Implement the exact v1 domain tags and Keccak-256 construction. Keccak-256 and FIPS SHA3-256 are different algorithms. Keep `contentHash`, `blockHash`, attestation digests, and Merkle values as distinct internal types even though their text formats are similar.

### 4. Implement parent normalization

Validate the complete collection, normalize accepted hash text, detect duplicates, sort deterministically, and enforce the protocol parent limit. Do not silently discard malformed entries. Diagnostic import utilities may return a valid subset, but callers must not confuse that utility with strict Block creation.

### 5. Implement the five-field Block

The v1 Block contains:

```text
{ blockHash, contentHash, parentHashes, content, protocolVersion }
```

`protocolVersion` is the exact string `"1"` and is excluded from both v1 hash preimages. `content` remains an ALX value and is required. Validate structural shape, version, normalized parents, `contentHash`, and `blockHash` without mutating the input.

### 6. Keep Block and Graph validation separate

A valid Block can participate in an incomplete Graph or may not have Graph verification requested. Do not collapse these claims into one Boolean result.

Implement the canonical operation as:

```text
validateGraph(seed, source, context) -> GraphVerification
```

The seed is supplied separately. The Block source resolves requested normalized identities without silently collapsing duplicate candidates. Only reachable, in-scope candidates affect the result.

Apply the canonical status precedence:

```text
invalid > resource_limit_reached > incomplete > valid
```

`checked: false` belongs to an enclosing result when Graph verification was not performed; `not_checked` is not a Graph status.

### 7. Implement verification context and budgets

Closed-world mode is the default. Open-world mode excludes only explicitly declared external parents from required resolution. An undeclared missing parent remains required and produces `incomplete` unless a higher-precedence condition exists.

`maxDepth` is an intentional claim boundary. Resource limits are execution budgets. A bounded `valid` result claims only the work required by that context.

Ensure deterministic traversal, counts, missing/external collections, issues, and limit reporting. Budget exhaustion must never be reported as `valid` or as a protocol violation without an independent violation.

### 8. Implement Trace independently

Trace construction accepts a root and complete adjacency representation for the requested Trace context. Prepare the supplied adjacency input before traversal, reject cycles, compute exact arbitrary-precision `pathCount` values, and serialize counts as canonical decimal digits.

Trace completeness describes lineage resolution only. It does not describe pagination, index coverage, observation scope, or query truncation.

### 9. Map failures by layer

Distinguish malformed request rejection, checked protocol violations, missing data, resource exhaustion, optional extension failures, and local operational errors. Compare canonical `ALX_*` identifiers where required; human-readable messages are not portable protocol output.

## Conformance adapter

Implement the newline-delimited JSON interface in [`../../conformance/README.md`](../../conformance/README.md). Keep stdout machine-readable and send diagnostics to stderr. Report language-native cases that cannot cross the JSON boundary accurately rather than counting them as portable passes.

The suite manifest, not this guide, determines required operations and cases. Never hard-code a historical vector count.

## Verification progression

From the repository root:

```bash
node conformance/bin/run.js --impl "<your adapter command>"
```

For a maintained implementation, also add native tests for values the JSON adapter cannot express, malformed native inputs, deterministic repeat execution, and resource boundaries. Cross-language candidates should be added to differential verification after their core suite passes independently.

## Common implementation failures

| Failure | Typical cause |
|---|---|
| Canonical byte mismatch | Host-language JSON serializer, key ordering, or number formatting differs |
| Hash mismatch | SHA3-256 substituted for Keccak-256 or domain terminator omitted |
| Invalid Block accepted | `protocolVersion`, extra fields, or `contentHash` not validated |
| Missing parent reported invalid | Availability collapsed into protocol validity |
| Duplicate Block lost | Source converted to a map before collision diagnosis |
| Incorrect `valid` claim | Depth or resource boundary omitted from the result context |
| Trace precision loss | Fixed-width integer used for `pathCount` |
| Cross-language drift | Insertion order or localized error text compared as normative |

## Related documents

- [`independent-implementation-checklist.md`](./independent-implementation-checklist.md) — completion checklist
- [`conformance.md`](./conformance.md) — claim and runner model
- [`protocol-errors-and-diagnostics.md`](./protocol-errors-and-diagnostics.md) — failure-layer guidance
- [`../data-model.md`](../data-model.md) — structure map
- [`../operations.md`](../operations.md) — operation classification

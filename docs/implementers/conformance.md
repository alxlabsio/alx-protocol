# Protocol conformance

The document explains the conformance model defined by the specification, schemas, canonical vectors, and the operational suite manifest.

---

## Protocol conformance requirement

An implementation is conformant when the required ALX protocol suites pass without modification to suites, vectors, or expected assertions.

Protocol conformance is suite-specific:

- canonicalization suites require exact byte output;
- semantic suites verify required protocol outcomes without claiming every emitted field is byte-identical across implementations.

## Suite Discovery

The core suite manifest is:

```text
protocol/suites.json
```

The conformance runner is:

```text
conformance/bin/run.js
```

Run the self-test from the repository root:

```bash
pnpm run test:conformance
```

Run an external implementation:

```bash
node conformance/bin/run.js --impl "./my-implementation"
```

Repository maintainers run all three maintained implementations and the pairwise differential gate with:

```bash
pnpm run verify:cross-language
```

## Core Suite Inventory

| Suite | Comparison mode | Purpose |
|---|---|---|
| `canonicalization` | exact-output | Canonical JSON byte output |
| `canonicalization-negative` | semantic | Rejection behavior |
| `canonicalization-depth` | semantic | Depth-limit behavior |
| `block-identity` | semantic | Content and Block hash identity |
| `parent-normalization` | semantic | Fail-closed parent collection and entry behavior |
| `parent-limits` | semantic | Parent count and normalization behavior |
| `attribution-trace` | semantic | Trace structure and metrics |
| `lineage-negative` | semantic | Invalid graph behavior |
| `lineage-boundaries` | semantic | Closed-world and open-world boundaries |
| `graph-validation-outcomes` | exact-output | Graph outcome, precedence, scope, and resource-boundary envelopes |
| `semantic-validity` | semantic | Required validation outcomes |
| `semantic-integrity` | semantic | Tamper and mismatch detection |

## Required Core Behaviors

A core-conformant implementation must support:

- canonicalization;
- content hash derivation;
- Block hash derivation;
- Block creation;
- Block validation;
- parent normalization;
- lineage validation;
- Attribution Trace generation and verification;
- validation context handling.

## Exact-Output Requirements

Canonicalization requires exact byte output.

For identical JSON inputs, implementations must produce the same canonical string and UTF-8 bytes.

## Semantic Requirements

Semantic suites verify protocol meaning.

Semantic suites assert outcomes such as:

- hashes match expected identity rules;
- invalid Blocks fail validation;
- duplicate parents are rejected or normalized as specified;
- missing parents are handled according to validation mode;
- external parents remain explicit boundaries;
- traces report completeness honestly.

Semantic conformance requires no byte-identical diagnostic fields, warning strings, or convenience outputs.

## Differential verification

The differential gate is an additional repository-maintainer check, not a replacement for canonical expected results. TypeScript, Python, and Rust are compared pairwise for portable canonicalization, complete Blocks, Graph verification, and Trace construction. No implementation is treated as the reference oracle and no majority vote can override canonical sources.

Repeated execution, reversed or deterministically shuffled finite Block-source order, and reversed Graph insertion order must preserve normative output. Canonical error identifiers must agree; implementation-specific message text need not. The JSON evidence report records suite digests, adapter outputs or errors, expected-result mismatches, pairwise mismatches, and determinism mismatches.

## Optional extension conformance

Merkle and signing are optional extensions.

Implementations that claim Merkle support should pass:

```bash
alx extension-conformance merkle
```

Implementations that claim signing support should pass:

```bash
alx extension-conformance signing
```

Extension support is additive. Core Block identity is unaffected.

## Failure Conditions

An implementation fails conformance when the implementation:

- fails a required core suite;
- changes canonicalization output;
- derives different content or Block hashes for the same valid inputs;
- accepts invalid structures that the protocol requires the implementation to reject;
- treats optional extension behavior as core validity;
- introduces environment-dependent behavior into core operations.

## Related Documents

- [`../../protocol/suites.json`](../../protocol/suites.json)
- [`../../test-vectors/`](../../test-vectors/)
- [`../../conformance/README.md`](../../conformance/README.md)
- [`../../reference-implementations/PARITY.md`](../../reference-implementations/PARITY.md)

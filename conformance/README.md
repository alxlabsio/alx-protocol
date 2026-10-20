# Protocol conformance runner

This directory contains the ALX conformance runner.

The runner verifies that an implementation satisfies the protocol suites declared in `protocol/suites.json`.

## Quick Start

From the repository root:

```bash
pnpm run test:conformance
```

Run the runner directly:

```bash
node conformance/bin/run.js --self-test
```

Test an external implementation:

```bash
node conformance/bin/run.js --impl "node sdk/conformance-adapter.js"
```

Verify all three maintained implementations together:

```bash
pnpm run verify:cross-language
```

## Protocol conformance model

Protocol conformance is suite-specific.

Canonicalization vectors require exact byte output. Graph verification vectors require exact complete result objects. Other vectors assert protocol semantics, including hash identity, lineage behavior, trace correctness, and extension behavior.

A conformant implementation satisfies the expected outputs or semantic assertions defined by each suite.

The JSON adapter cannot transport language-native values such as negative zero, `undefined`, `NaN`, cyclic references, `BigInt`, or `Symbol`. The external runner reports these cases as skipped. A full conformance claim requires the applicable native implementation suite in addition to the portable adapter run.

## Cross-language differential verification

`conformance/bin/run-differential.js` requires the TypeScript, Python, and Rust adapters. It does not select an oracle or use majority agreement. Each canonical exact-output case is checked against its declared expected result, then every maintained implementation is compared pairwise.

The gate covers portable canonicalization, complete created Blocks, all canonical `validateGraph` operations, and canonical Trace construction. It repeats deterministic operations, reverses and deterministically shuffles finite Block-source order, reverses Graph insertion order, and exercises shared Unicode boundaries. Human-readable error messages are non-normative; canonical `ALX_*` error identifiers are compared exactly.

The runner has per-call time and output bounds and always writes a machine-readable report by default to `artifacts/cross-language/differential-report.json`. Override the evidence location with `--report <path>`.

## Core Suite Inventory

| Suite | Comparison mode |
|---|---|
| `canonicalization` | exact-output |
| `canonicalization-negative` | semantic |
| `canonicalization-depth` | semantic |
| `block-identity` | semantic |
| `raw-json-ingress` | exact-output |
| `parent-normalization` | semantic |
| `parent-limits` | semantic |
| `attribution-trace` | semantic |
| `trace-boundaries` | exact-output |
| `lineage-negative` | semantic |
| `lineage-boundaries` | semantic |
| `graph-validation-outcomes` | exact-output |
| `graph-validation-interactions` | exact-output |
| `semantic-validity` | semantic |
| `semantic-integrity` | semantic |

The manifest comparison mode is the suite default. Mixed-operation suites may contain exact vectors through a vector-level override. Every `validateGraph` vector is exact even when its containing suite otherwise uses semantic comparison. Differential verification complements these suite assertions; implementation agreement alone does not establish protocol correctness.

## Interface Contract

External implementations expose a process that reads one JSON operation per line from stdin and writes one JSON result per line to stdout.

Example:

```bash
echo '{"operation":"canonicalize","input":{"b":2,"a":1}}' | ./my-impl
```

Expected response shape:

```json
{"output":"{\"a\":1,\"b\":2}"}
```

On failure, the implementation should return:

```json
{"error":"message"}
```

## Core Operations

| Operation | Input | Output |
|---|---|---|
| `canonicalize` | JSON value | canonical string |
| `deriveBlockHash` | `{ "content": ..., "parentHashes": [...] }` | hash string |
| `deriveContentHash` | `{ "content": ... }` | hash string |
| `createBlock` | `{ "content": ..., "parentHashes": [...] }` | Block |
| `validateBlock` | Block | validation result |
| `normalizeHashes` | array of candidate hashes | normalized hash array |
| `validateLineage` | Block hash, parents, optional known hashes and context | lineage validation result |
| `traceAttribution` | `{ "rootHash": "0x...", "graph": {...} }` | Attribution Trace |
| `validateGraph` | `{ "seed": Block, "source": { "kind": "finite", "blocks": [...] }, "context": VerificationContext }` | complete Graph verification result |
| `decodeRawJson` | `{ "rawHex": "..." }` | structured raw-ingress success or `ALX_SCHEMA_INVALID` failure before canonicalization |
| `verifyTrace` | trace + graph + context | trace verification result |

## Optional Extensions

Merkle and signing are optional extensions. They are not required for core conformance.

```bash
alx extension-conformance merkle
alx extension-conformance signing
```

Extension suites are additive. They do not alter core Block identity.

## Related Documents

- [`../protocol/suites.json`](../protocol/suites.json)
- [`../test-vectors/`](../test-vectors/)
- [`../reference-implementations/README.md`](../reference-implementations/README.md)
- [`../docs/implementers/conformance.md`](../docs/implementers/conformance.md)

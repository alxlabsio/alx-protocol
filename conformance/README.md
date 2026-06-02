# Conformance Runner

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

## Conformance Model

Conformance is suite-specific.

Canonicalization vectors require exact byte output. Other suites assert protocol semantics, including hash identity, validation behavior, lineage behavior, trace correctness, and extension behavior.

A conformant implementation satisfies the expected outputs or semantic assertions defined by each suite.

## Core Suite Inventory

| Suite | Comparison mode |
|---|---|
| `canonicalization` | exact-output |
| `canonicalization-negative` | semantic |
| `canonicalization-depth` | semantic |
| `block-identity` | semantic |
| `parent-limits` | semantic |
| `attribution-trace` | semantic |
| `lineage-negative` | semantic |
| `lineage-boundaries` | semantic |
| `semantic-validity` | semantic |
| `semantic-integrity` | semantic |

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
| `traceAttribution` | `{ "rootHash": "0x...", "graph": {...} }` | Attribution Trace |
| `validateGraph` | graph input | graph validation result |
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
- [`../protocol/test-vectors/`](../protocol/test-vectors/)
- [`../reference-implementations/README.md`](../reference-implementations/README.md)
- [`../docs/implementers/conformance.md`](../docs/implementers/conformance.md)

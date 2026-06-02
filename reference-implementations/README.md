# Reference Implementations

This directory contains peer conformance implementations of ALX Protocol — Python and Rust. The primary TypeScript SDK lives at [`sdk/`](../sdk/) and is the main developer integration surface.

Protocol truth is defined by:

1. `protocol/spec.md`
2. `protocol/schemas/`
3. `protocol/test-vectors/`
4. machine-readable verifier files in `protocol/`

No implementation is authoritative over the protocol.

## HTTP retrieval API

Block storage and lookup over HTTP are defined in [`protocol/retrieval-api.yaml`](../protocol/retrieval-api.yaml) (informative). The reference HTTP server is implemented in the CLI (`alx retrieval start`, `cli/server/retrieval-server.js`), not in the SDK or the Python/Rust packages. The SDK, Python, and Rust packages focus on local Block creation, validation, lineage, and trace.

## Implementations

| Language | Directory | Role | Status |
|---|---|---|---|
| TypeScript SDK | [`sdk/`](../sdk/) | Primary adoption surface — published as `@alx-protocol/sdk`, consumed by CLI | Active |
| Python | [`python/`](./python/) | Peer conformance implementation — AI/data ecosystem | Active |
| Rust | [`rust/`](./rust/) | Peer conformance implementation — verifier-grade anchor | Active |

See [`PARITY.md`](./PARITY.md) for current capability parity.

## Conformance Model

Conformance is suite-specific.

Canonicalization suites require exact byte output. Other suites assert protocol semantics, including hash identity, validation behavior, lineage behavior, trace correctness, and extension behavior.

A conformant implementation satisfies the expected outputs or semantic assertions defined by each suite.

## Running Tests

```bash
# TypeScript, from repo root
pnpm test

# Python
cd reference-implementations/python
pip install -e ".[dev]"
pytest tests/

# Rust
cd reference-implementations/rust
cargo test
```

Run cross-implementation conformance from the repo root:

```bash
pnpm run test:conformance
node conformance/bin/run.js --impl "node sdk/conformance-adapter.js"
node conformance/bin/run.js --impl "python reference-implementations/python/conformance_adapter.py"
node conformance/bin/run.js --impl "./reference-implementations/rust/target/release/conformance_adapter"
```

## Adapter Entry Points

| Language | Adapter |
|---|---|
| TypeScript | `sdk/conformance-adapter.js` |
| Python | `reference-implementations/python/conformance_adapter.py` |
| Rust | `reference-implementations/rust` binary `conformance_adapter` |

## Adding a New Implementation

Use the protocol files first, then implement a conformance adapter.

Start with [`../docs/implementers/implementer-guide.md`](../docs/implementers/implementer-guide.md).

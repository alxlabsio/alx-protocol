# ALX Protocol Rust Reference Implementation

The Rust implementation provides a verifier-grade reference for ALX Protocol.

It is a peer reference implementation. It does not define protocol truth. Protocol truth is defined by `protocol/spec.md`, `protocol/schemas/`, `test-vectors/`, and `protocol/error-codes.json`.

## Supported Capabilities

| Capability | Status |
|---|---|
| Canonicalization | Supported |
| Block creation | Supported |
| Block validation | Supported |
| Content hash derivation | Supported |
| Block hash derivation | Supported |
| Parent lineage validation | Supported |
| Canonical Graph verification | Supported |
| Trace generation | Supported |
| Verification context | Supported |
| Merkle extension helpers | Supported |
| Ed25519 signing | Supported |
| P-256 signing | Supported |
| EIP-712 signing | Not bundled |

EIP-712 is an optional Ethereum-compatible signing suite. It is not required for core protocol conformance.

## Install

```bash
cargo add alx-protocol
```

The crate is [`alx-protocol` on crates.io](https://crates.io/crates/alx-protocol); the library name is `alx_protocol`. To install the `alx` verifier binary, which provides `alx validate` and `alx trace`:

```bash
cargo install alx-protocol
```

The npm CLI also installs a command named `alx`. Install one of them per environment, or call the other by path.

## Run Tests

```bash
cd reference-implementations/rust
cargo test --all-targets
```

## Build the conformance adapter

```bash
cd reference-implementations/rust
cargo build --bin conformance_adapter --release
```

From the repository root:

```bash
node conformance/bin/run.js --impl "./reference-implementations/rust/target/release/conformance_adapter"
```

## Canonical Graph verification

`validate_graph_verification(&seed, &source, &context)` implements the normative
three-input `validateGraph(seed, source, context)` operation and returns the full
typed verification envelope. The existing `validate_graph` adjacency helper is
retained as a compatibility API and does not replace the canonical operation.

## Package Layout

| Path | Purpose |
|---|---|
| `src/block.rs` | Block creation and validation |
| `src/canonical.rs` | Canonicalization |
| `src/lineage.rs` | Graph and lineage validation |
| `src/graph_validation.rs` | Canonical finite-source Graph verification |
| `src/trace.rs` | Attribution Trace generation and verification |
| `src/verification_context.rs` | Closed-world and open-world validation context |
| `src/signatures.rs` | Signing model |
| `src/ed25519.rs` | Ed25519 backend |
| `src/p256_backend.rs` | P-256 backend |
| `src/bin/conformance_adapter.rs` | conformance adapter binary |
| `tests/` | Rust test suite |

## Known Differences

Rust is intended to match the protocol suites. Any skipped vector in Rust tests must include a local comment explaining the reason and must not be treated as a protocol exemption.

## Related Documents

- [`../../protocol/spec.md`](../../protocol/spec.md)
- [`../../test-vectors/`](../../test-vectors/)
- [`../PARITY.md`](../PARITY.md)
- [`../../docs/implementers/conformance.md`](../../docs/implementers/conformance.md)

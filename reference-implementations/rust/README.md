# ALX Protocol Rust Reference Implementation

The Rust implementation provides a verifier-grade reference for ALX Protocol.

It is a peer reference implementation. It does not define protocol truth. Protocol truth is defined by `protocol/spec.md`, `protocol/schemas/`, `protocol/test-vectors/`, and the machine-readable verifier files in `protocol/`.

## Supported Capabilities

| Capability | Status |
|---|---|
| Canonicalization | Supported |
| Block creation | Supported |
| Block validation | Supported |
| Content hash derivation | Supported |
| Block hash derivation | Supported |
| Parent lineage validation | Supported |
| Trace generation | Supported |
| Verification context | Supported |
| Merkle extension helpers | Supported |
| Ed25519 signing | Supported |
| P-256 signing | Supported |
| EIP-712 signing | Not bundled |

EIP-712 is an optional Ethereum-compatible signing suite. It is not required for core protocol conformance.

## Run Tests

```bash
cd reference-implementations/rust
cargo test --all-targets
```

## Build Conformance Adapter

```bash
cd reference-implementations/rust
cargo build --bin conformance_adapter --release
```

From the repository root:

```bash
node conformance/bin/run.js --impl "./reference-implementations/rust/target/release/conformance_adapter"
```

## Package Layout

| Path | Purpose |
|---|---|
| `src/block.rs` | Block creation and validation |
| `src/canonical.rs` | Canonicalization |
| `src/lineage.rs` | Graph and lineage validation |
| `src/trace.rs` | Attribution Trace generation and verification |
| `src/verification_context.rs` | Closed-world and open-world validation context |
| `src/signatures.rs` | Signing model |
| `src/ed25519.rs` | Ed25519 backend |
| `src/p256_backend.rs` | P-256 backend |
| `src/bin/conformance_adapter.rs` | Conformance adapter binary |
| `tests/` | Rust test suite |

## Known Differences

Rust is intended to match the protocol suites. Any skipped vector in Rust tests must include a local comment explaining the reason and must not be treated as a protocol exemption.

## Related Documents

- [`../../protocol/spec.md`](../../protocol/spec.md)
- [`../../protocol/test-vectors/`](../../protocol/test-vectors/)
- [`../PARITY.md`](../PARITY.md)
- [`../../docs/implementers/conformance.md`](../../docs/implementers/conformance.md)

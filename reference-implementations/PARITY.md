# Cross-Language Parity

This matrix describes current implementation parity across ALX reference implementations.

Core capabilities are required for protocol conformance. Extension and tooling capabilities are additive and do not change core Block identity.

| Capability | TypeScript | Python | Rust | Status |
|---|---:|---:|---:|---|
| Canonicalization | Yes | Yes | Yes | Core required |
| Block creation | Yes | Yes | Yes | Core required |
| Block validation | Yes | Yes | Yes | Core required |
| Content hash derivation | Yes | Yes | Yes | Core required |
| Block hash derivation | Yes | Yes | Yes | Core required |
| Parent normalization | Yes | Yes | Yes | Core required |
| Lineage validation | Yes | Yes | Yes | Core required |
| Trace generation | Yes | Yes | Yes | Core required |
| Verification context | Yes | Yes | Yes | Core required |
| Verification receipts | Yes | Yes | Yes | Core-adjacent tooling |
| Merkle extension | Yes | Yes | Yes | Optional extension |
| Ed25519 signing | Yes | Yes | Yes | Optional extension |
| P-256 signing | Yes | Yes | Yes | Optional extension |
| EIP-712 signing | Yes | No | No | Optional Ethereum-compatible signing suite |
| IPFS package manifest validation | Yes | No | No | Optional package tooling |
| CLI package verification | Yes | No | No | Tooling |
| Receipt replay CLI | Yes | No | No | Tooling |

## Notes

- TypeScript is the most complete developer-facing SDK today.
- Python and Rust are real peer implementations for core protocol behavior.
- Optional extensions are not required for core conformance.
- EIP-712 is intentionally not required for Python or Rust parity.
- IPFS package manifest validation: the `ipfs-artifact-package` extension defines a JSON Schema, manifest format, and schema-only conformance vectors under `protocol/extensions/ipfs-artifact-package/test-vectors/`. Validation is schema-based only.
- IPFS package verification is currently implemented as repository tooling and CLI behavior, not as core protocol validity.

## Conformance Boundary

Canonicalization vectors require exact byte output.

Other suites assert protocol semantics, including hash identity, validation behavior, lineage behavior, trace correctness, and extension behavior.

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
| Canonical Graph verification | Yes | Yes | Yes | Core required |
| Trace generation | Yes | Yes | Yes | Core required |
| Verification context | Yes | Yes | Yes | Core required |
| Verification receipts | Yes | Yes | Yes | Core-adjacent tooling |
| Merkle extension | Yes | Yes | Yes | Optional extension |
| Ed25519 signing | Yes | Yes | Yes | Optional extension |
| P-256 signing | Yes | Yes | Yes | Optional extension |
| EIP-712 signing | Yes | No | No | Optional Ethereum-compatible signing suite |

## Notes

- TypeScript is the most complete developer-facing SDK today.
- Python and Rust are real peer implementations for core protocol behavior.
- Optional extensions are not required for core conformance.
- EIP-712 is intentionally not required for Python or Rust parity.

## Protocol conformance boundary

Canonicalization vectors require exact byte output.

Other suites assert protocol semantics, including hash identity, validation behavior, lineage behavior, trace correctness, and extension behavior.

The repository's mandatory differential gate compares all three maintained adapters pairwise for portable canonicalization, complete Blocks, canonical Graph verification, and Trace construction. It also checks deterministic repeat and input-order transformations. Canonical expected results remain authoritative over implementation agreement.

## Related Documents

- [Protocol specification](../protocol/spec.md)
- [Conformance runner](../conformance/README.md)

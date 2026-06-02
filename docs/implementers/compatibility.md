# Compatibility Matrix

The document reports cross-language implementation status. Cross-language status reports remain outside the protocol specification.

---

Cross-implementation conformance status for ALX Protocol v1.

## Core Conformance Matrix

| Implementation | Language | Role | Version | Vectors Passed | Status | Adapter |
|---|---|---|---|---|---|---|
| TypeScript SDK | TypeScript | Primary SDK — conformance adapter ships alongside | 1.0.0 | core suite | **Conformant** | `conformance-adapter.js` |
| Rust reference | Rust | Peer reference implementation | 1.0.0 | core suite | **Conformant** | `src/bin/conformance_adapter.rs` |
| Python reference | Python | Peer reference implementation | 1.0.0 | core suite | **Conformant** | `conformance_adapter.py` |

TypeScript, Python, and Rust are conformant on the core protocol. Merkle proofs and signed Block handling are supported across the reference implementations as optional extensions rather than core conformance requirements. Advanced signer backends vary by implementation.

## SDK Feature Parity Matrix

| Surface | TypeScript | Python | Rust |
|---|---|---|---|
| Core protocol v1 conformance | Yes | Yes | Yes |
| Graph helpers | Yes | Yes | Yes |
| Merkle proofs | Yes | Yes | Yes |
| Signed Blocks | Yes | Yes | Yes |
| Multiple attestations | Yes | Yes | Yes |
| Replay helpers | Yes | Yes | Yes |
| Signer/verifier abstraction | Yes | Yes | Yes |
| Built-in signer backends | EIP-712, Ed25519, P-256 | Ed25519, P-256 | Ed25519, P-256 |

Core conformance and convenience surface are separate claims. The conformance matrix proves deterministic cross-language agreement for the normative protocol. The feature matrix shows optional implementation surface around that shared core without ranking one implementation above the others.

## Version Alignment

| Component | Version | Protocol Compatibility |
|---|---|---|
| Protocol spec | v1 | Canonical |
| Test vectors | core vectors plus separate extension vectors | Core v1 plus separately classified extension coverage |
| TypeScript SDK (`@alx-protocol/sdk`) | 1.0.0 | Implements protocol v1 |
| Python package (`alx-protocol`) | 1.0.0 | Implements protocol v1 |
| Rust crate (`alx-protocol`) | 1.0.0 | Implements protocol v1 |
| CLI (`@alx-protocol/cli`) | 1.0.0 | Compatible with protocol v1 |
| On-chain checkpoint integrations | External integration candidate | Not part of core conformance |

## Test Vector Suites

| Suite | Vectors | Covers |
|---|---|---|
| Canonicalization | 21 | JSON serialization rules (null, bool, int, float, string, array, object, scientific notation) |
| Canonicalization (negative) | 6 | Rejection cases (NaN, Infinity, unsafe int, depth overflow) |
| Block Identity | 7 | Hash derivation, parent normalization, deduplication |
| Attribution Trace | 6 | Graph traversal, pathCounts, determinism, cycles |
| Lineage (negative) | 6 | Self-reference, cycles, duplicates, invalid hashes |
### Optional Extension Suites

| Suite | Vectors | Covers |
|---|---:|---|
| Merkle | 9 | Root construction and proof verification |
| Signing | 4 | Legacy/plural attestation handling and signed-block rejection paths |

## Compatibility Verification Procedure

```bash
# Self-Test (TypeScript Directly)
node conformance/bin/run.js --self-test

# External Implementation Testing
node conformance/bin/run.js --impl "node sdk/conformance-adapter.js"
node conformance/bin/run.js --impl "python reference-implementations/python/conformance_adapter.py"
node conformance/bin/run.js --impl "<path-to-rust-binary>"
```

## Known Limitations

- EIP-712 remains implemented only in TypeScript pending a deliberate cross-language typed-data/recovery design pass
- The Rust conformance adapter requires compilation (`cargo build --bin conformance_adapter --release`)

## Adding A New Implementation

1. Implement the core operations (canonicalize, deriveBlockHash, createBlock, traceAttribution)
2. Build a conformance adapter following the stdin/stdout JSON protocol (see `conformance/README.md`)
3. Run: `node conformance/bin/run.js --impl "./path/to/adapter"`
4. Report core-suite results for the core conformance claim
5. When Merkle support is claimed, also run `alx extension-conformance merkle`
6. When signing support is claimed, also run `alx extension-conformance signing`

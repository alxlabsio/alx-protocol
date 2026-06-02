# Merkle Extension

**Status:** Optional extension  
**Audience:** Implementers, adapter authors  
**Authority:** Defines optional Merkle extension behavior. Does not alter core Block identity or core conformance.

## Purpose

This extension defines deterministic Merkle checkpoint proofs for integrations that need batched inclusion proofs, such as on-chain anchoring adapters.

Merkle is **not required** to create, verify, exchange, or trace ALX Blocks. A core-conformant implementation may omit this extension entirely.

## Extension Surface

The Merkle extension consists of:

- `buildMerkleTree`
- `getMerkleProof`
- `verifyMerkleProof`

These operations use sorted-pair hashing over `blockHash` leaves and remain orthogonal to Block identity.

## Conformance

Merkle extension conformance is separate from core ALX conformance.

- Core vectors: `protocol/test-vectors/`
- Merkle extension vectors: `protocol/extensions/merkle/test-vectors/`
- Runner: `alx extension-conformance merkle`

Implementations claiming Merkle extension support should pass the Merkle extension suite. Implementations claiming only core ALX conformance are not required to implement Merkle.

## Related Documents

- [`../../spec.md`](../../spec.md) — core protocol specification
- [`./test-vectors/merkle.json`](./test-vectors/merkle.json) — Merkle extension vectors
- [`../../../docs/implementers/conformance.md`](../../../docs/implementers/conformance.md) — core versus extension conformance boundary

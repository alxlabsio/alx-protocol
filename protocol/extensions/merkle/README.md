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

## Tree Construction

Each input leaf MUST normalize to a lowercase `0x`-prefixed 32-byte Block hash. The complete leaf array is sorted lexicographically. Duplicate leaves are preserved.

Each adjacent pair is ordered by its raw 32-byte value and hashed as `keccak256(min || max)`. No prefix, length, or domain byte is inserted. An unpaired value at any level is promoted unchanged to the next level. Construction repeats until one root remains.

An empty leaf array is invalid. A single-leaf tree has that leaf as its root and has an empty inclusion proof.

## Proof Encoding

A proof is the ordered array of sibling hashes encountered from the leaf level toward the root. Verification starts with the leaf and applies the same sorted-pair hash for each sibling. Direction bits are unnecessary because each pair is sorted.

For duplicate leaves, `getMerkleProof` selects the first occurrence in canonical leaf order. The proof establishes inclusion of the hash value, not the multiplicity or position of an occurrence. Applications requiring occurrence identity MUST commit that identity inside distinct Block content.

The extension defines no protocol-validity limit on leaf count or proof length. Implementations and services MAY apply documented operational limits before allocating or traversing a tree.

## Conformance

Merkle extension conformance is separate from core ALX conformance.

- Core vectors: `test-vectors/`
- Merkle extension vectors: `protocol/extensions/merkle/test-vectors/`
- Runner: `alx extension-conformance merkle`

Implementations claiming Merkle extension support should pass the Merkle extension suite. Implementations claiming only core ALX conformance are not required to implement Merkle.

## Related Documents

- [`../../spec.md`](../../spec.md) — core protocol specification
- [`./test-vectors/merkle.json`](./test-vectors/merkle.json) — Merkle extension vectors
- [`../../../docs/implementers/conformance.md`](../../../docs/implementers/conformance.md) — core versus extension conformance boundary

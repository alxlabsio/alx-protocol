# Signing Extension

Signing is an optional extension family, not the ALX core signing model.

Portable v1 suites currently defined here:

- `alx.signing.ed25519.v1`
- `alx.signing.p256.v1`

An Ethereum-compatible suite may be added later as `alx.signing.eip712.v1`, with its own focused typed-data and recovery specification. EIP-712 must remain an optional backend, not a protocol-wide default.

**Status:** Optional extension
**Audience:** Implementers, attestation authors
**Authority:** Defines optional signing extension behavior. Does not alter core Block identity or core conformance.

## Purpose

This extension defines signed Block validation behavior for implementations that choose to support attestations.

Signing is **not required** to create, verify, exchange, or trace ALX Blocks. A core-conformant implementation may omit this extension entirely.

## Extension Surface

The signing extension currently covers:

- `attestation`
- `attestations[]`
- `validateSignedBlock`

Attestations remain orthogonal to Block identity: signed and unsigned Blocks with the same `content` and `parentHashes` have the same `blockHash`.

## Portable Attestation Digest

Portable Ed25519 and P-256 attestations sign the raw 32-byte digest:

```text
keccak256(
  UTF8("ALX-ATTESTATION-V1\0") ||
  canonicalize({ algorithm, attester, blockHash, timestamp })
)
```

The domain terminator is one zero byte. The canonical payload contains exactly the four fields shown. Changing any payload field invalidates the signature.

Ed25519 public keys are 32 bytes and signatures are 64 bytes, each encoded as lowercase `0x`-prefixed hexadecimal. P-256 public keys use the 65-byte uncompressed SEC1 encoding. P-256 signatures use the 64-byte compact `r || s` encoding. P-256 signers MUST produce low-S signatures, and verifiers MUST reject noncanonical high-S signatures.

Algorithm identifiers are case-sensitive and use the exact lowercase values `ed25519` and `p256`. Attester and signature strings are compared byte-for-byte after structural validation; verifiers MUST NOT case-fold their textual encodings.

The `ed25519` suite uses pure Ed25519 as defined by RFC 8032. It does not use Ed25519ctx or Ed25519ph. The 32-byte attestation digest is the Ed25519 message.

The `p256` suite uses ECDSA over the NIST P-256 curve. The 32-byte attestation digest is supplied directly as the ECDSA prehash and MUST NOT be hashed again. Compact signature components MUST satisfy `1 <= r < n` and `1 <= s <= floor(n / 2)`, where `n` is the P-256 group order.

`timestamp` is a non-negative integer no greater than `9007199254740991`. It is an authenticated claim only. Clock interpretation, expiration, freshness, and replay policy remain application responsibilities.

A portable attestation proves that the corresponding signing key signed the exact attestation payload. It does not establish authorization, ownership, legal identity, content truth, timestamp freshness, uniqueness, quorum weight, or permission to perform an application action. Repeating an identical attestation does not create additional protocol weight. Applications requiring purpose, audience, nonce, expiry, or authorization must use a separately domain-separated application envelope.

The Signed Block envelope can carry other application-defined algorithm identifiers. Such identifiers are outside the two portable v1 suites and require their own encoding and verification profile.

## Conformance

Signing extension conformance is separate from core ALX conformance.

- Core vectors: `test-vectors/`
- Signing extension vectors: `protocol/extensions/signing/test-vectors/`
- Runner: `alx extension-conformance signing`

Implementations claiming signing extension support should pass the signing extension suite. Implementations claiming only core ALX conformance are not required to implement signing.

## Related Documents

- [`../../spec.md`](../../spec.md) — core protocol specification
- [`./test-vectors/signed-blocks.json`](./test-vectors/signed-blocks.json) — signing extension vectors
- [`../../../docs/implementers/conformance.md`](../../../docs/implementers/conformance.md) — core versus extension conformance boundary

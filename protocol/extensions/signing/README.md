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

## Conformance

Signing extension conformance is separate from core ALX conformance.

- Core vectors: `protocol/test-vectors/`
- Signing extension vectors: `protocol/extensions/signing/test-vectors/`
- Runner: `alx extension-conformance signing`

Implementations claiming signing extension support should pass the signing extension suite. Implementations claiming only core ALX conformance are not required to implement signing.

## Related Documents

- [`../../spec.md`](../../spec.md) — core protocol specification
- [`./test-vectors/signed-blocks.json`](./test-vectors/signed-blocks.json) — signing extension vectors
- [`../../../docs/implementers/conformance.md`](../../../docs/implementers/conformance.md) — core versus extension conformance boundary

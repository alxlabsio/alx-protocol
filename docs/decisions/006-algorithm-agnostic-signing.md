# ADR-006: Algorithm-Agnostic Signing For Portable Attestations

This architecture decision records how ALX Protocol enables portable attestation workflows through algorithm-agnostic signing interfaces.

---

**Date:** 2026-05-11

## Context

ALX Protocol supports attestation workflows for Blocks. Product teams, agents, reviewers, services, and organizations may attach verifiable claims such as:

- who created a Block
- who reviewed a Block
- which agent produced a Block
- which service verified a Block
- which key, wallet, identity provider, or signing backend produced the attestation

Different adopters use different signing environments. EVM applications commonly use EIP-712. Solana and many developer ecosystems use Ed25519. WebAuthn and passkey-based systems use P-256. Enterprise systems may use cloud KMS, HSMs, RSA, ECDSA, or organization-specific signing infrastructure.

ALX Protocol Block identity remains derived from canonical content and parent references. Signing adds an attestation layer around that identity and preserves the same underlying `blockHash`.

## Decision

Define algorithm-agnostic `Signer` and `Verifier` interfaces.

Provide EIP-712 and Ed25519 as built-in implementations. Allow additional signing algorithms through the same interface.

The result is a shared attestation model that allows product teams to use signing systems matched to ecosystem, infrastructure, compliance requirements, and user experience.

## Rationale

1. **Portable attestation workflows.** ALX Protocol supports authorship, review, approval, and verification claims across EVM wallets, Ed25519 keys, passkeys, cloud KMS, enterprise identity systems, and future signing backends.

2. **Stable Block identity.** A Block’s `blockHash` is derived from canonical content and parent references. Signing algorithms can vary, and Block identity remains stable.

3. **Clear protocol boundary.** Core Block validity remains focused on deterministic identity and lineage. Signing systems provide optional trust, authorship, review, approval, and accountability signals.

4. **Minimal core dependency surface.** Optional signing dependencies keep the core SDK lightweight. Product teams install cryptographic packages matching the chosen attestation workflow.

5. **Explicit verification routing.** The `attestation.algorithm` field identifies the verification implementation for a given attestation.

6. **Extension-ready design.** New signing systems can be added by implementing the shared interfaces. The protocol identity model remains stable.

## Built-In Implementations

| Class | Algorithm | Dependency | Product Use Case |
|---|---|---|---|
| `Eip712Signer` / `Eip712Verifier` | `eip712` | `ethers` optional peer dependency | Ethereum wallets, EVM applications, on-chain identity workflows |
| `Ed25519Signer` / `Ed25519Verifier` | `ed25519` | `@noble/ed25519` optional peer dependency | Solana-style keys, SSH-style keys, developer tooling, general-purpose attestations |

## Design Options Reviewed

- **Algorithm-agnostic signing interfaces:** Supports portable attestations, stable Block identity, optional crypto dependencies, and future signing backends. ALX selects this model for the attestation interface.

- **EIP-712-only signing:** Provides strong alignment with Ethereum wallet workflows. ALX includes EIP-712 as a built-in implementation and keeps the signing boundary open to additional ecosystems.

- **Ed25519-only signing:** Provides a lightweight signing model for developer, agent, and non-EVM workflows. ALX includes Ed25519 support and preserves compatibility with EVM signing workflows.

- **Interface-only signing surface:** Provides maximum flexibility for implementers. ALX includes built-in implementations to improve adoption ergonomics and demonstrate the shared `Signer` and `Verifier` model.

- **Generic crypto abstraction layer:** Provides a broader plugin-style surface. ALX uses small explicit interfaces plus concrete implementations to keep the signing boundary simple and testable.

## Consequences

- The `Signer` interface exposes `getId()`, `sign(data)`, and `algorithm`.

- The `Verifier` interface exposes `verify(data, signature, expectedSigner?)` and `algorithm`.

- The `attestation.algorithm` field identifies the verification route for signed Blocks.

- Additional algorithms such as P-256, RSA, ECDSA, HSM-backed signing, cloud KMS, and passkey-based signing can be added through the same interface.

- Signing dependencies can remain optional peer dependencies with lazy loading.

- The `data` parameter is the raw 32-byte Block hash decoded from hex.

- Conformance and regression tests should verify that signing algorithms remain outside Block identity and that each verifier validates the expected raw Block hash bytes.

## Related Documents

- [`004-attestation-orthogonality.md`](./004-attestation-orthogonality.md)
- [`../protocol/extensions/signing/`](../protocol/extensions/signing/)
- [`../protocol/spec.md`](../protocol/spec.md)
- [`../deep-dives/core-contract.md`](../deep-dives/core-contract.md)
- [`../integrators/extensions.md`](../integrators/extensions.md)

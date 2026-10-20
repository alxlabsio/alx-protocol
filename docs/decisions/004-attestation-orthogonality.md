# ADR-004: Separate Attestation From Block Identity

This architecture decision records how ALX Protocol preserves stable Block identity while allowing products to attach optional authorship, review, approval, and verification claims through attestations.

---

**Date:** 2025-04-15

## Context

ALX Protocol needs to support authorship, review, and verification claims around Blocks. Product workflows may need to answer questions such as:

- Who created this Block?
- Who reviewed this Block?
- Which system signed this Block?
- Which authority attested to this artifact?
- Which key, wallet, account, or service produced the claim?

These claims support trust, accountability, review, marketplace, compliance, and agent workflows. ALX Protocol Block identity also needs to remain deterministic across environments. The same canonical content and parent references should produce the same `blockHash` across implementations, signing systems, and product workflows.

## Decision

ALX Protocol treats attestation as **separate from Block identity**.

A Block’s `blockHash` is derived from canonical `content` and `parentHashes`. The optional signing extension wraps a complete core Block with `attestation` or `attestations`; those fields are not core Block fields and remain outside the hash envelope.

Signing adds trust context around a Block and preserves the Block’s deterministic identity.

## Rationale

1. **Stable Block identity.** The same canonical content and parent references produce the same `blockHash` across implementations, storage systems, product workflows, and signing environments.

2. **Flexible authorship workflows.** A Block can be created, shared, reviewed, signed, countersigned, approved, published, or audited at different points in a workflow. Product teams can support draft, review, approval, publication, and audit flows around the same Block identity.

3. **Portable signing support.** Attestations can use different signing systems, including EIP-712, Ed25519, P-256, RSA, cloud KMS, enterprise identity providers, or product-specific signing services.

4. **Layered verification model.** Block integrity can be verified from canonical content and parent references. Authorship, review, approval, and accountability claims can be verified through the attestation layer.

5. **Multi-party trust models.** Multiple users, agents, services, reviewers, organizations, or systems can attest to the same Block identity through product or extension layers.

6. **Clear protocol boundary.** Core Block validity remains focused on deterministic identity and lineage. Signing systems provide optional trust, authorship, review, approval, and accountability signals.

## Design Options Reviewed

- **Separate attestation from Block identity:** Supports stable content-addressing, flexible authorship workflows, and verification claims around the same Block identity. ALX v1 selects this model for attestation boundaries.

- **Signature-bound Block identity:** Includes signature material in the hash input. This design gives each signer or signing algorithm a distinct identity output for the same content and parent references. ALX v1 selects stable Block identity so signatures can evolve around the underlying artifact identity.

- **Always-signed Blocks:** Requires every Block exchange to carry an authorship claim. ALX v1 supports local validation, testing, unsigned drafts, machine-generated artifacts, and hash-integrity workflows without the optional signing wrapper.

- **External-only attestation store:** Stores attestations in a separate registry or database. ALX v1 defines an optional `SignedBlock` wrapper and also permits external attestation registries at the application layer.

## Consequences

- A core Block and a valid signing-extension wrapper around it expose the same underlying `blockHash`.

- Removing the wrapper removes the attestation claim and preserves verification of the enclosed core Block.

- Applications that require signed artifacts should enforce signature requirements at the product, workflow, policy, or integration layer.

- The signing extension supports multiple attestations; applications may also use external registries or product-specific trust layers.

- Signing-extension conformance verifies that attestations remain outside the hash envelope and that the enclosed Block identity is unchanged.

## Related Documents

- [`../../protocol/spec.md`](../../protocol/spec.md)
- [`../../protocol/extensions/signing/`](../../protocol/extensions/signing/)
- [`006-algorithm-agnostic-signing.md`](./006-algorithm-agnostic-signing.md)
- [`../../protocol/extensions/signing/README.md`](../../protocol/extensions/signing/README.md)
- [`../integrators/extensions.md`](../integrators/extensions.md)

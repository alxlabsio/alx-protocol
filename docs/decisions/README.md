# Architecture Decision Records

This directory contains Architecture Decision Records for ALX Protocol. Each record explains a design decision that shapes Block identity, verification behavior, extension boundaries, implementation guidance, or product integration surfaces.

Architecture Decision Records help reviewers, implementers, and maintainers understand how ALX design choices support deterministic identity, local verification, portable attestations, and product-facing integration patterns. Normative protocol behavior remains defined by [`../protocol/spec.md`](../protocol/spec.md), schemas, conformance rules, and test vectors.

## Decision Index

| ADR | Decision Area | Product Capability |
|---|---|---|
| [`001-keccak-256.md`](./001-keccak-256.md) | Hashing and identity | Stable Block identity and EVM-compatible verification surfaces |
| [`002-content-opacity.md`](./002-content-opacity.md) | Content model | Broad artifact support across AI, data, code, research, and product workflows |
| [`003-no-consensus.md`](./003-no-consensus.md) | Verification model | Local verification across storage systems, applications, and deployment environments |
| [`004-attestation-orthogonality.md`](./004-attestation-orthogonality.md) | Signing boundary | Stable Block identity with flexible authorship and verification proofs |
| [`005-incremental-validation.md`](./005-incremental-validation.md) | Graph validation | Efficient validation for streaming pipelines and agent workflows |
| [`006-algorithm-agnostic-signing.md`](./006-algorithm-agnostic-signing.md) | Attestation interface | Portable signing support across EVM, Ed25519, WebAuthn, KMS, and future signing systems |

## Architecture Decision Record Usage

Each decision record describes:

1. The product or protocol problem.
2. The selected design.
3. The capability enabled by the design.
4. The design options reviewed.
5. The implementation and compatibility consequences.

Decision records are explanatory. Each record clarifies design intent and implementation expectations while preserving the normative authority of the protocol specification, schemas, conformance rules, and test vectors.

## Adding A New Decision Record

New decision records should use the next sequential ADR number and follow the existing filename format:

```txt
NNN-short-decision-name.md
```

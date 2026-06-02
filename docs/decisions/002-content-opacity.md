# ADR-002: Opaque Content For Universal Artifact Support

This architecture decision records how content opacity allows ALX Protocol v1 Blocks to support many artifact types while keeping protocol verification focused on deterministic identity, lineage, and structural validity.

---

**Date:** 2025-04-15

## Context

ALX Protocol supports verifiable digital artifacts across AI, software, research, compliance, education, creative media, and product workflows. These artifacts can contain many forms of JSON-serializable content, including research summaries, source code, structured analysis, generated responses, metadata objects, numeric values, and domain-specific records.

A shared protocol identity layer needs stable rules for hashing and lineage while allowing applications to define domain-specific meaning, validation, display, and workflow behavior.

## Decision

ALX Protocol treats `content` as **opaque**.

The protocol canonicalizes and hashes JSON-serializable content as part of Block identity. Application layers own content interpretation, domain validation, display behavior, semantic meaning, and workflow-specific constraints.

## Rationale

1. **Broad artifact support.** Opaque content allows ALX Protocol Blocks to represent many artifact types across AI systems, developer tools, research workflows, compliance pipelines, education platforms, creative tools, and product applications.

2. **Clear protocol boundary.** ALX provides deterministic identity, lineage, and verification structure. Applications provide content schemas, semantic validation, user-facing interpretation, and domain-specific rules.

3. **Forward-compatible product design.** New artifact types use the same ALX v1 Block structure when content is JSON-serializable. Product teams can introduce new content conventions while preserving the protocol identity model.

4. **Stable implementation behavior.** Implementations can canonicalize and hash content consistently with a shared protocol algorithm. Domain-specific parsers, validators, and schema registries remain in application or extension layers.

5. **Focused verification surface.** Protocol verification operates on canonical structure and hashable content. Application layers handle content-specific safety, correctness, policy, and execution context.

## Design Options Reviewed

- **Opaque JSON-serializable content:** Supports broad artifact compatibility, stable Block identity, simple implementation requirements, and product-level extensibility. ALX v1 selects this model for core Block content.

- **Protocol-required content schemas:** Provides stronger domain structure for specific applications. ALX v1 keeps schemas at the application and extension layer so the core protocol can support many artifact categories through one identity model.

- **Protocol-level content type field:** Provides a built-in type hint for routing and interpretation. ALX v1 keeps type labels, model cards, media descriptors, and domain metadata inside application-owned content or extension surfaces.

## Consequences

- ALX Protocol-compatible implementations canonicalize and hash `content` as part of Block identity while leaving domain meaning to application layers.

- Content correctness, domain validation, safety policy, display behavior, and business rules remain application-owned concerns.

- **Implication for regulated environments.** Content opacity means ALX provides no built-in filtering for sensitive data, PII, or regulated content. A regulated deployment must inspect and approve content before calling `createBlock`. Once sealed, the Block identity is bound to the exact content bytes. Data governance enforcement must occur at the application layer, before the Block creation boundary.

- Content schema conventions can live in integrator guides, extension documents, product schemas, or application-level standards while core Block validity remains stable.

- Canonical test vectors should include diverse JSON-serializable content forms, including strings, objects, arrays, numbers, booleans, and null values, to demonstrate content opacity.

- Product teams can build specialized workflows on ALX Blocks while preserving the same core identity and lineage model.

- Reviewers can evaluate Block identity and lineage independently from domain-specific content interpretation.

## Related Documents

- [`../protocol/spec.md`](../protocol/spec.md)
- [`../deep-dives/canonical-envelope.md`](../deep-dives/canonical-envelope.md)
- [`../integrators/extensions.md`](../integrators/extensions.md)
- [`../integrators/ai-conventions.md`](../integrators/ai-conventions.md)

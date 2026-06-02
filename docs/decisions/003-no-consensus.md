# ADR-003: Stateless Verification And Application-Level Ordering

This architecture decision records how ALX Protocol supports stateless local verification while allowing applications to define ordering, checkpointing, sequencing, publication, and coordination through product-specific layers.

---

**Date:** 2025-04-15

## Context

Distributed systems often use mechanisms for ordering, coordination, membership, and shared-state agreement. Examples include consensus protocols, ledgers, checkpoint systems, sequencers, timestamp services, and application-specific registries.

ALX Protocol focuses on verifiable Block identity and lineage. A Block carries the information needed for local verification: canonical content, parent references, and deterministic identity. Applications define how Blocks are stored, ordered, indexed, checkpointed, displayed, published, or coordinated.

This separation allows ALX Protocol to serve as a portable verification layer across databases, content-addressed storage systems, local files, APIs, agent workflows, and product infrastructure.

## Decision

ALX Protocol uses a **stateless local verification model**.

Block validity is derived from canonical Block structure, content, parent references, and deterministic hashing. Applications own ordering, set membership, timestamps, sequencing, publication rules, registry behavior, and shared-state coordination.

The stateless local verification model keeps ALX Protocol focused on portable verification while allowing products to add coordination layers as workflows require.

## Rationale

1. **Local verification.** ALX Protocol allows any participant to verify a Block using the Block’s content, parent references, and canonical hashing rules. Verification can run from local data and deterministic protocol rules.

2. **Storage independence.** Blocks can live in PostgreSQL, IPFS, S3, local files, memory, APIs, artifact packages, or product databases. The verification model remains consistent across storage environments.

3. **Product flexibility.** Applications can define ordering, publication, indexing, checkpointing, registry behavior, and accepted-state rules based on product requirements.

4. **Efficient developer workflows.** Verification runs through canonicalization and hashing, supporting local development, CI pipelines, agent systems, and high-throughput artifact workflows.

5. **Composable coordination layers.** Products that need public ordering, timestamp proofs, registry membership, marketplace state, or release status can add checkpoint systems, sequencers, ledgers, registries, or application-specific coordination layers around ALX Blocks.

6. **Graph-native causality.** Parent references encode derivation relationships directly in the Block graph. The graph structure gives applications a lineage model for reasoning about dependencies, reuse, derived artifacts, and attribution traces.

## Design Options Reviewed

- **Stateless local verification:** Supports portable Block verification across storage systems, applications, product workflows, and deployment environments. ALX v1 selects this model for core verification behavior.

- **Protocol-level consensus:** Provides a shared ordering and coordination layer inside the protocol. ALX v1 keeps coordination in product and infrastructure layers so verification remains portable, lightweight, and implementation-focused.

- **Mandatory external ordering:** Provides timestamps, sequencing, or publication order for every Block. ALX v1 treats ordering as an application-owned capability so products can choose registries, ledgers, checkpoint systems, sequencers, or local indexes based on their needs.

- **Merkle clock or vector clock:** Provides explicit causal-order metadata. ALX v1 uses parent references as the primary derivation graph, allowing lineage to represent causal relationships through Block structure.

## Consequences

- ALX Protocol-compatible implementations verify Blocks through canonical structure, content, parent references, and deterministic hashing.

- Applications define concepts such as “latest Block,” “published Block,” “canonical set,” “accepted revision,” “current version,” and “official registry entry.”

- Product teams can add checkpointing, timestamp anchoring, registries, sequencers, ledgers, or release channels as optional coordination layers.

- Two parties can create equivalent Blocks independently and derive the same Block identity when canonical content and parent references match.

- Lineage remains available through parent references, while ordering, publication status, and set membership remain product-owned concerns.

- Conformance tests should focus on deterministic identity, parent-reference handling, lineage validation, and verification behavior.

## Related Documents

- [`../protocol/spec.md`](../protocol/spec.md)
- [`../deep-dives/lineage.md`](../deep-dives/lineage.md)
- [`../deep-dives/core-contract.md`](../deep-dives/core-contract.md)
- [`../integrators/storage.md`](../integrators/storage.md)
- [`../integrators/extensions.md`](../integrators/extensions.md)

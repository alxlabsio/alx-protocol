# Integration Boundaries

The document describes where ALX Protocol sits relative to adjacent systems and how adjacent systems compose.

Protocol behavior remains defined by [`protocol/spec.md`](../../protocol/spec.md).

---

## ALX Protocol Capabilities

ALX Protocol defines:

- deterministic Block identity (contentHash, blockHash)
- parent-bound lineage (parentHashes)
- Attribution Trace generation
- local verification without an external dependency

ALX Protocol leaves the following outside core scope:

- storage
- transport
- content schemas
- signing requirements
- consensus

Application layers and adjacent systems own those concerns.

---

## Integration With Version Control

ALX Protocol complements version control. Blocks are immutable and have no branching, merging, or staging semantics.

ALX Protocol fits alongside version control as a lineage layer for produced artifacts:

- reference Block hashes in commit metadata
- create Blocks representing build outputs, generated files, or transformation results
- use parentHashes to record which source content shaped a derived artifact

---

## Integration With Content-Addressed Storage

ALX Protocol uses keccak-256 for Block identity. Content-addressed storage systems use independent addressing schemes.

ALX Protocol Blocks are plain JSON, storable and retrievable by any content-addressed storage system.

ALX Protocol verifies artifact identity and lineage. Storage systems provide retrieval and availability.

Those concerns remain separate.

**Pattern — ALX Protocol with a content-addressed storage system:**

Store Blocks as content-addressed objects. Include locally recomputable content identifiers in artifact package manifests. Retrieve Blocks by content-derived identifier. Verify Block identity and lineage through ALX Protocol hash validation. Storage availability and ALX Protocol verification remain independent operations.

---

## Integration With Attestation Systems

ALX Protocol Blocks are valid without any attestation. Signing is an optional extension.

Attestation systems can reference ALX Protocol Block hashes in attestation data fields to record external claims about a Block's identity or lineage.

**Pattern — ALX Protocol with on-chain attestation:**

Produce a Block and record its blockHash in an on-chain attestation record. ALX Protocol provides the lineage graph and local verification. The attestation system provides the on-chain claim and anchoring record.

---

## Integration With Structured Data Systems

ALX Protocol Blocks are immutable. Structured data systems that support mutable records operate at a different layer.

ALX Protocol fits as an identity and lineage layer for specific versions or snapshots:

- store Block hashes as identifiers in structured data records
- reference Block hashes when a specific verified version of content is needed

---

## Fit Criteria

ALX Protocol suits workflows that need:

- deterministic artifact identity across producers, tools, or environments
- inspectable lineage from a derived artifact back to its sources
- local verification without a live external dependency
- content opacity — the protocol leaves content meaning to application layers
- composability with storage, signing, and checkpoint systems

ALX Protocol excludes from core scope:

- transport or storage infrastructure
- content-aware diffing, merging, or querying
- mutable record workflows
- mandatory on-chain state

---

## Related Documents

- [`../architecture.md`](../architecture.md) — protocol layers and product boundaries
- [`../trust-model.md`](../trust-model.md) — verification guarantees and trust boundaries
- [`./faq.md`](./faq.md) — common integration questions

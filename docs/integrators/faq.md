# Frequently Asked Questions

Common integration questions about ALX Protocol. Protocol behavior remains defined by [`../../protocol/spec.md`](../../protocol/spec.md).

---

## Purpose

Answers to questions integrators raise when adopting ALX Protocol.

---

## Protocol Basics

### Block Primitive

A Block is the single primitive in ALX Protocol. A Block binds content and parent lineage into a deterministic blockHash: `{ blockHash, contentHash, parentHashes, content, protocolVersion }`. The `blockHash` is deterministically derived from the content and parent references using Keccak-256 hashing. The protocol hashes and verifies Blocks without inspecting or interpreting `content`.

### Hash Algorithm Selection

Keccak-256 provides deterministic hashing and aligns with systems that already use Keccak. Optional external checkpoint integrations can reuse the same hash space without changing Block identity.

### Content Opacity

The protocol separates structure (how Blocks relate) from semantics (what Blocks mean). The separation allows the same protocol to handle AI model output, research documents, compliance artifacts, or any other content type without protocol changes. Content schemas remain an application-level concern — see [`extensions.md`](./extensions.md) for patterns.

### Block Mutability

Blocks are immutable by design. The `blockHash` is derived from the content and parents; changing either produces a different hash, meaning a different Block. To represent a revision, create a new Block that references the original as a parent.

### Shared Content, Distinct Lineage

Two Blocks with the same `content` but different `parentHashes` carry different `blockHash` values and the same `contentHash`. The design is intentional — `blockHash` captures both content and lineage, while `contentHash` captures content alone. Two teams using the same research to reach different conclusions produce Blocks with the same `contentHash` but different `blockHash` values.

### Content Size Limits

Content size limits remain outside the protocol scope. The canonicalization depth limit is 128 levels of nesting. Practical limits depend on the storage and transport layer. The SDK processes content in memory, so very large payloads (hundreds of megabytes) may cause memory pressure.

---

## Lineage And Attribution

### parentHashes Semantics

`parentHashes` is an unordered set of parent Block hashes. The field declares that the Block was built using the listed Blocks. The protocol normalizes parents (lowercase, deduplicate, sort) for determinism. The semantic meaning of the relationship — whether derivation, citation, or supersession — is an application concern expressed in `content`.

### pathCount Definition

`pathCount` is the number of distinct paths from the root Block to a given node in the lineage Graph. In a diamond Graph where Block D is reachable from Block A via two different paths (A→B→D and A→C→D), D has `pathCount = 2`. Path counts are exact, computed via topological propagation — never approximated.

### pathCount And Contribution Policy

`pathCount` is structural, not a policy decision. `pathCount` reports how many distinct derivation paths exist. Whether `pathCount / totalPaths` serves as a contribution weight, a threshold applies, or a completely different formula governs settlement is the application's concern. See [`application-settlement-boundaries.md`](./application-settlement-boundaries.md) for patterns.

### Graph Acyclicity

Blocks form a directed acyclic Graph — cycles are structurally invalid. `validateGraph()` detects cycles and reports the offending nodes. `traceAttribution()` fails with `ALX_GRAPH_CYCLE` and produces no Trace when a cycle is detected. A Block cannot be its own ancestor.

### Missing Or Unavailable Parents

`createBlock()` accepts syntactically valid parent hashes without retrieving those Blocks. Graph verification interprets availability through its explicit context: unavailable required data produces `incomplete` when no known violation or resource outcome takes precedence, while an open-world context may declare specific external parents outside the inspected scope. Neither result proves the unavailable Blocks exist or are valid.

---

## Storage And Transport

### Storage System Requirement

Blocks are storage-independent. Blocks can be stored in PostgreSQL, SQLite, an object store, the filesystem, or in-memory. A content-addressed storage system is one option — see [`storage.md`](./storage.md). Storage and transport remain outside the protocol scope.

### Blockchain Requirement

External checkpoint integrations are optional. A checkpoint can provide an external timestamp proof for a set of Blocks, but Block creation, validation, and attribution tracing work locally and off-chain.

### Relational Database Storage

A v1 Block has five fields: `blockHash`, `contentHash`, `parentHashes`, `content`, and `protocolVersion`. Map the fields to columns in any relational or document database and use `blockHash` as the protocol identity key. See [`database-guide.md`](./database-guide.md) for application schema recommendations.

### Content-Addressed Storage Identifiers

Two addressing schemes are complementary. A Block's `blockHash` is protocol-level identity (keccak-256). A content-derived storage identifier is a storage-layer address (multihash). Blocks can be stored in a content-addressed storage system alongside a mapping between `blockHash` and the storage identifier. The Block remains verifiable regardless of storage location.

---

## Signing And Verification

### Signing Requirement

Signing is orthogonal to Block identity. A Block's `blockHash` is always computed from content and parents — never from a signature. The optional signing extension wraps a Block with an attestation. Use `createSignedBlock` when the application needs proof that a key signed the extension payload; key ownership and authorization still require application policy.

### blockHash And Signatures

Recomputing `blockHash` verifies integrity of the Block's identity inputs. A valid extension signature proves that the corresponding key signed the defined attestation payload. These checks are independent: the core Block can be verified without a signature, and the signing wrapper preserves its `blockHash`.

### Signing Algorithm Support

The TypeScript SDK exposes algorithm-agnostic `Signer` and `Verifier` interfaces and includes several backends. Portable signing-extension conformance currently covers Ed25519 and P-256. EIP-712 is a TypeScript application backend; other algorithms need an explicit application or extension profile before their encodings can interoperate. See [`api-reference.md`](./api-reference.md).

### Ethereum Wallet Requirement

An Ethereum wallet is required only when an application chooses Ethereum-compatible signing or an external checkpoint integration. Core Block creation, validation, Graph verification, and Trace generation require no wallet.

---

## Integration

### Agent Framework Integration

Wrap selected agent inputs and outputs as Blocks at durable application boundaries. Pass the direct parent Blocks' `blockHash` values to `createBlock`, then verify the resulting Blocks and requested Graph context. See [`agent-integration.md`](./agent-integration.md).

### Cross-Implementation Interoperability

All conformant implementations produce byte-identical output for the same input across the core protocol surface. Verify core conformance with `alx test-vectors run` or the conformance runner. When the implementation also supports optional extensions, verify the extensions separately with `alx extension-conformance merkle` and `alx extension-conformance signing`.

### Protocol conformance test suite

A set of canonical vectors for the core protocol surface: canonicalization, block identity, attribution tracing, lineage validation, and rejection tests. Optional extensions such as Merkle and signing have separate suites and leave the core conformance claim unchanged. See [`../implementers/conformance.md`](../implementers/conformance.md).

---

## System Boundaries

### Version Control Systems

ALX Protocol defines Blocks with deterministic identity and lineage, with attribution tracing over opaque `content`. Version control systems track file-system snapshots with branches, merges, and diffs. ALX has no working directory — a Block is the atomic unit. ALX computes `pathCount` per Graph node.

### Content-Addressed Storage Systems

A content-addressed storage system provides data retrieval by hash — store data, receive an address, retrieve by address. ALX Protocol provides deterministic Block identity with lineage — a Block carries a blockHash derived from content and parentHashes, and a deterministic attribution structure. Blocks can be stored in a content-addressed storage system with a mapping between `blockHash` and the storage-level address.

### On-Chain Attestation Services

On-chain attestation services provide attestations with arbitrary schemas. ALX Protocol provides Blocks with deterministic identity, lineage, and attribution tracing. ALX Blocks are off-chain with optional on-chain anchoring. ALX adds deterministic Graph structure and `pathCount`-based attribution. The two layers can compose — anchor ALX checkpoints as on-chain attestations.

---

## Related Documents

- [`./typescript-sdk-quick-start.md`](./typescript-sdk-quick-start.md) — five-minute getting-started tutorial
- [`./api-reference.md`](./api-reference.md) — SDK API reference
- [`./troubleshooting.md`](./troubleshooting.md) — error diagnosis and resolutions
- [`../../protocol/spec.md`](../../protocol/spec.md) — normative specification
- [`../architecture.md`](../architecture.md) — four-layer architecture

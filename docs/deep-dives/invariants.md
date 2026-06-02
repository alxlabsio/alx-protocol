# Protocol Invariants

The document defines the semantic guarantees that ALX Protocol-compatible implementations preserve across identity, lineage, immutability, attribution, optional extension behavior, and deterministic execution.

These invariants help implementers, maintainers, reviewers, and conformance authors understand which properties must remain stable across languages, runtimes, SDKs, and product integrations.

---

Protocol invariants describe the behavior that makes ALX Protocol Blocks reproducible, verifiable, composable, and portable.

Conforming implementations preserve the invariants through canonicalization rules, hash derivation, lineage validation, graph verification, attribution tracing, extension verification, and conformance testing.

---

## 1. Identity Invariants

### INV-01: Deterministic Canonicalization

Equivalent protocol inputs MUST canonicalize to identical byte sequences.

Requirements:

- canonicalization MUST be fully specified
- canonicalization MUST be independent of language, runtime, platform, host environment, and implementation details
- canonical byte output MUST be reproducible across conformant implementations

Product capability:

- ALX artifacts can retain stable identity across SDKs, services, storage systems, and deployment environments

### INV-02: Deterministic Block Identity

`blockHash` MUST be derived solely from `content` and normalized `parentHashes`.

Requirements:

- identical `content` and identical normalized `parentHashes` MUST produce the same `blockHash`
- system time, randomness, network state, storage location, signing state, metadata, and execution environment MUST NOT influence Block identity

Product capability:

- ALX Blocks can be verified independently by any party using the same canonical input

### INV-03: Cross-Implementation Conformance

Independent implementations MUST produce identical `blockHash` values for identical protocol inputs.

Requirements:

- conformance MUST be verified through shared test vectors
- canonicalization vectors MUST verify exact byte output
- semantic conformance suites MUST verify matching protocol outcomes

Product capability:

- TypeScript, Python, Rust, and future implementations can interoperate through shared identity and validation behavior

## 2. Lineage Invariants

### INV-04: Referential Integrity

`parentHashes` references SHOULD resolve to valid Block identifiers within the evaluation context.

Requirements:

- unresolved parent references MAY produce validation errors depending on the evaluation context
- resolution behavior MUST be deterministic
- validation results MUST remain reproducible for identical inputs and known Block sets

Product capability:

- ALX workflows can verify whether a Block’s declared dependencies are available, inspectable, and structurally valid

### INV-05: Acyclicity

The Block graph MUST be acyclic.

Requirements:

- a Block MUST NOT become its own ancestor
- cycle detection MUST be deterministic
- graph validation MUST produce consistent results across conformant implementations

Product capability:

- ALX lineage can support reproducible derivation graphs, audit trails, derivation chains, and attribution traces

### INV-06: Self-Reference Prevention

A Block MUST NOT appear in its own `parentHashes`.

Requirements:

- direct self-reference MUST be detected during lineage validation
- self-reference detection MUST use normalized Block identifiers
- validation behavior MUST remain deterministic

Product capability:

- ALX prevents invalid single-Block dependency loops before graph-level traversal

### INV-07: Parent Uniqueness

Each parent hash MUST appear at most once after normalization.

Requirements:

- implementations MUST normalize `parentHashes` before hashing
- duplicate parent inputs MUST NOT affect Block identity
- duplicate detection behavior MUST remain deterministic

Product capability:

- ALX Blocks preserve stable identity across parent input ordering, casing, and duplicate-entry variations

## 3. Immutability Invariants

### INV-08: Block Immutability

A Block’s `content` and `parentHashes` MUST remain immutable after creation.

Requirements:

- modifying `content` MUST produce a new `contentHash`
- modifying `content` or `parentHashes` MUST produce a new `blockHash`
- Block identity MUST derive from canonicalized content and parentHashes

Product capability:

- ALX artifacts can support reproducible review, versioning, audit, verification, and package workflows

### INV-09: Hash Security Assumption

`blockHash` is computed using Keccak-256.

Requirements:

- ALX assumes Keccak-256 collision resistance for Block identity
- ALX assumes preimage resistance for deterministic Block identity verification
- implementations MUST use the protocol-defined Keccak-256 semantics for hash derivation

Product capability:

- ALX Blocks serve as stable deterministic identifiers across verification, lineage, and integration surfaces

## 4. Attribution Invariants

### INV-10: Deterministic Attribution Trace

`traceAttribution(rootHash, graph)` MUST produce identical output for identical inputs.

Inputs: (`rootHash`, `graph`)

Outputs MUST be identical in:

- node set
- edge set
- depth values
- path counts
- ordering (if defined)

Traversal strategy MUST NOT affect results.

### INV-11: Complete Reachability

All Blocks reachable from the traversal root MUST be included in the attribution trace.

Requirements:

- reachable Blocks MUST be included
- unreachable Blocks MUST be excluded
- reachability MUST be computed deterministically
- equivalent graphs MUST produce equivalent reachable Block sets

Product capability:

- ALX attribution traces can reflect the full dependency structure behind a selected artifact

## 5. Optional Merkle Extension Invariants

These invariants apply to implementations that support the optional Merkle extension.

### INV-12: Checkpoint Integrity

A Merkle proof verified against a checkpoint `rootHash` MUST deterministically confirm or deny inclusion.

Requirements:

- proof verification MUST be deterministic
- invalid proofs MUST be rejected
- inclusion results MUST be reproducible across conformant Merkle-extension implementations

Product capability:

- ALX artifact sets can support batch verification, checkpoint validation, audit trails, and external anchoring workflows

### INV-13: Order-Independent Merkle Root

Merkle tree construction MUST be order-independent for equivalent leaf sets.

Requirements:

- identical leaf sets MUST produce identical roots
- pair hashing strategy MUST be deterministic
- sorted-pair hashing or an equivalent deterministic construction MUST be used consistently

Product capability:

- ALX checkpoint surfaces can remain stable across input ordering differences

## 6. Global Determinism Invariant

### INV-14: Protocol Determinism

All protocol-defined operations MUST be pure, deterministic, and reproducible.

Requirements:

- operations MUST preserve input values without mutation
- operations MUST produce identical outputs for identical inputs
- operations MUST be free from external dependencies

Protocol-defined operations MUST NOT depend on:

- system time
- randomness
- I/O state
- network state
- storage location
- platform-specific behavior
- host environment behavior

Product capability:

- ALX verification can run consistently in local development, CI, backend services, agent workflows, artifact packages, and independent implementations

## 7. Invariant Enforcement Mapping

| Invariant | Enforced By | Verification Surface |
|---|---|---|
| `INV-01` | `canonicalize` | Canonicalization vectors |
| `INV-02` | `deriveBlockHash` | Block identity vectors |
| `INV-03` | Cross-language conformance suites | TypeScript, Python, Rust, and future implementation parity |
| `INV-04` | `validateLineage` | Parent resolution tests |
| `INV-05` | `validateGraph` | Cycle detection tests |
| `INV-06` | `validateLineage` | Self-reference tests |
| `INV-07` | `normalizeHashes` | Parent normalization tests |
| `INV-08` | `createBlock` and immutable data model usage | Mutation and hash-change tests |
| `INV-09` | Keccak-256 hash implementation | Hash function vectors |
| `INV-10` | `traceAttribution` | Attribution trace tests |
| `INV-11` | `traceAttribution` | Reachability tests |
| `INV-12` | `verifyMerkleProof` | Optional Merkle extension tests |
| `INV-13` | `buildMerkleTree` | Optional Merkle root determinism tests |
| `INV-14` | Whole protocol surface | Determinism, purity, and regression tests |

---

## Related Documents

- [`core-contract.md`](./core-contract.md) — summary of core guarantees enforced by these invariants
- [`canonical-envelope.md`](./canonical-envelope.md) — identity and canonicalization invariants in detail
- [`lineage.md`](./lineage.md) — Graph and lineage invariants in detail
- [`../implementers/conformance.md`](../implementers/conformance.md) — conformance suites that verify invariant behavior
- [`../../protocol/spec.md`](../../protocol/spec.md) — normative protocol behavior

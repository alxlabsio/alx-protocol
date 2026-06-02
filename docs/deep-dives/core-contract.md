# Core Contract

ALX core guarantees. The protocol core scope remains unchanged; expanded behavior remains outside the core contract document.

---

Deterministic infrastructure for verifiable, composable digital artifacts and verifiable lineage.

---

## 1. Invariants

ALX defines three foundational invariants. The three invariants are non-negotiable and MUST hold across all conformant implementations.

### 1.1 Identity

Blocks MUST have deterministic identifiers derived solely from canonicalized content and parentHashes.

- same input yields same identifier
- no external state may influence identity

### 1.2 Lineage

Blocks MUST form a directed acyclic Graph (Graph) through explicit parent references.

- each artifact declares dependencies via `parentHashes`
- cycles are invalid
- graph structure MUST be verifiable independently

### 1.3 Attribution

Attribution MUST be:

- deterministic
- derived exclusively from lineage
- independent of traversal order or implementation details

Identical graphs MUST produce identical attribution outputs.

### 1.4 Determinism Guarantee

All protocol-defined operations MUST be:

- pure
- deterministic
- fully specified

Independent implementations MUST produce identical outputs for identical inputs.

### 1.5 External Anchoring

ALX MAY anchor artifact state externally (for example, via checkpoints) to enable:

- verifiable inclusion proofs
- ordering guarantees

Anchoring:

- MUST NOT affect identity
- MUST NOT affect lineage
- MUST NOT affect attribution

Anchoring is strictly an external verification mechanism.

## 2. The Primitive

The core unit of the protocol is the Block.

A Block binds artifact content and parent lineage into a single deterministic blockHash.

```text
Block = {
  blockHash,
  contentHash,
  parentHashes,
  content
}
```

### 2.1 Field Definitions

| Field | Description |
|---|---|
| `blockHash` | Deterministic identity derived from content and parents |
| `contentHash` | Deterministic hash of content only |
| `parentHashes` | Normalized set of parent `blockHash` values |
| `content` | Opaque payload (outside protocol interpretation scope) |

### 2.2 Field Derivation

```text
contentHash = keccak256(canonicalize(content))

blockHash = keccak256(
  canonicalize({
    content,
    parentHashes
  })
)
```

### 2.3 Structural Properties

- `blockHash` uniquely identifies the block
- `contentHash` isolates payload identity from lineage
- `parentHashes` defines graph edges
- `content` is protocol-agnostic

## 3. Operations

ALX defines a strictly layered execution model:

`Canonicalize -> Hash -> Validate -> Trace`

Each layer MUST depend only on outputs of prior layers.

### 3.1 Operation Layers

| Layer | Function | Purpose |
|---|---|---|
| Canonicalize | `canonicalizeProtocolJson` | Deterministic serialization |
| Hash | `deriveBlockHash` | Compute identity |
| Validate | `validateGraph`, `verifyGraph` | Ensure structural and cryptographic correctness |
| Trace | `traceAttribution` | Compute contribution structure |

### 3.2 Layer Constraints

- no layer may depend on external state
- no layer may mutate input data
- each layer MUST be independently testable
- outputs MUST be reproducible across implementations

### 3.3 Signing (Orthogonal Concern)

Signing remains outside the core protocol.

- MAY be applied at any layer
- MUST NOT affect canonicalization or hashing
- provides attestation; identity derivation remains separate from attestation

## 4. Protocol Scope

### 4.1 ALX Protocol Definition

ALX is:

- a typed block protocol
- a deterministic Graph validation protocol
- a lineage and attribution protocol
- a lightweight workflow memory layer
- a portable provenance format

### 4.2 Boundaries

ALX scope excludes the following:

- a blockchain
- an execution runtime
- an economic or incentive system
- a storage layer

### 4.3 Chain Interaction

If used, a blockchain serves only to:

- anchor block existence
- provide ordering guarantees
- enable third-party verification

Important:

- the chain remains outside truth definition for Block identity
- the chain remains outside identity computation
- the chain remains outside influence on protocol outputs

Checkpoints prove inclusion and relative ordering; precise wall-clock time remains outside checkpoint scope.

## 5. Core Contract Significance

ALX enables:

- verifiability: any party can independently validate artifacts
- composability: artifacts can build on one another without coordination
- attribution: contributions are traceable and reproducible
- portability: artifacts remain independent of any single system

Two independent implementations that follow the core contract specification will:

- produce identical hashes
- validate identical graphs
- derive identical attribution

The guarantees above hold without shared infrastructure, coordination, or trust assumptions.

## 6. Implementation Implications (Non-Normative)

To correctly implement the core contract:

- treat all protocol operations as pure functions
- enforce strict canonicalization compliance
- reject behavior outside deterministic specification
- validate graph integrity before attribution
- isolate protocol logic from storage, networking, and execution layers

---

## Related Documents

- [`canonical-envelope.md`](./canonical-envelope.md) — deterministic identity derivation
- [`lineage.md`](./lineage.md) — Graph validation and `parentHashes` rules
- [`invariants.md`](./invariants.md) — invariant enforcement mapping
- [`../data-model.md`](../data-model.md) — Block and Trace structures
- [`../../protocol/spec.md`](../../protocol/spec.md) — normative protocol behavior

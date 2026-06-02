# Lineage And Graph Validation

The document explains how ALX Protocol Blocks form verifiable lineage through `parentHashes`, acyclic Graph structure, and deterministic graph validation.

This document elaborates on the protocol specification. Core protocol behavior remains defined by the normative specification, schemas, conformance rules, and test vectors.

---

Lineage gives ALX Protocol artifacts a verifiable dependency structure. A Block can reference earlier Blocks through `parentHashes`, allowing product workflows to represent derivation, reuse, review history, artifact evolution, and multi-step knowledge construction.

In ALX Protocol, lineage is structural. The protocol verifies `parentHashes`, Graph shape, acyclicity, and deterministic identity. Application layers define semantic relationships such as citation meaning, revision meaning, approval meaning, or domain-specific derivation meaning.

---

## 1. Structure

Each Block declares zero or more parents through `parentHashes`.

- edges are directed from child to parent
- each entry in `parentHashes` identifies a parent Block the current Block depends on
- the complete set of Blocks and `parentHashes` edges forms an acyclic Graph
- Graph structure supports local verification, attribution tracing, artifact review, and product-level dependency reasoning

```text
Block C -> [Block A, Block B]    (C references A and B)
Block A -> []                    (A has zero parents)
Block B -> [Block A]             (B references A)
```

Definitions:

- Parent: a Block referenced in `parentHashes`
- Child: a Block that references one or more parents
- Traversal Root: starting Block for graph operations
- Structural leaf: Block with no parents
- Lineage Graph: acyclic Graph formed by Blocks and `parentHashes` edges

## 2. Lineage Rules

| Rule | Requirement |
|---|---|
| Acyclicity | The Graph MUST be acyclic, meaning a Block cannot become its own ancestor |
| Self-reference prevention | A Block MUST NOT appear in its own `parentHashes` |
| Parent uniqueness | Each parent `blockHash` MUST appear at most once after normalization |
| Parent normalization | `parentHashes` MUST be normalized before hashing through lowercase conversion, deduplication, sorting, and invalid-entry handling |
| Deterministic ordering | Parent ordering MUST be lexicographic using UTF-16 code unit order |
| Order-independent identity | Different input orderings of the same parent set MUST produce the same `blockHash` |

## 3. Validation

Lineage validation operates at two levels: block-level and graph-level.

### 3.1 Block-Level Validation

`validateLineage(blockHash, parentHashes, knownHashes)`

Checks a single Block for:

- duplicate parents (pre-normalization)
- self-reference
- missing parents (against `knownHashes`)

Requirements:

- validation MUST be deterministic
- multiple issues MAY be reported simultaneously
- validation MUST NOT mutate inputs

### 3.2 Graph-Level Validation

`validateGraph(graph)`

Checks the entire Graph:

- applies block-level checks to all Blocks
- detects cycles across the Graph

Cycle detection:

- MUST be deterministic
- SHOULD be implemented using DFS or equivalent
- time complexity MUST be `O(V + E)`

### 3.3 Graph Verification (Integrity)

`verifyGraph(blocks, computeHash)`

Verifies both structure and content integrity:

- recomputes each `blockHash` from `{content, parentHashes}`
- confirms:
  - hash correctness
  - each `parentHashes` entry resolves to an existing Block

Guarantees:

- structural validity (Graph correctness)
- cryptographic integrity (`content` <-> hash consistency)

## 4. Structural Vs Semantic Lineage

Lineage in ALX is purely structural.

The protocol enforces:

- valid references
- Graph constraints

The protocol treats meaning as opaque.

Examples of semantic relationships:

- `derived_from`
- `supersedes`
- `cites`

These MUST be expressed inside `content` using application-level conventions.

## 5. Lineage Immutability

Lineage is immutable because `parentHashes` participate in `blockHash` derivation.

Changing a Block's `parentHashes` produces a new Block identity.

```text
Old Block -> New Block with updated parentHashes
```

## 6. Determinism Guarantees

All lineage operations MUST be:

- deterministic
- pure
- independent of external state
- reproducible across implementations

Specifically:

- parent normalization MUST produce identical outputs across implementations
- cycle detection MUST produce consistent results for identical graphs
- validation outputs MUST remain stable for identical inputs
- graph verification MUST derive the same integrity result across conformant implementations

## 7. Implementation Notes

These notes guide implementers without expanding protocol behavior.

- normalize `parentHashes` before hashing and validation
- use adjacency maps for efficient graph traversal
- cache visited nodes during cycle detection
- keep lineage validation separate from graph verification
- preserve input immutability during validation
- treat out-of-order parent arrival as an application ingestion concern
- use conformance vectors to verify cross-language behavior

## 8. Lineage Error Mapping

| Rule | Error |
|---|---|
| Self-reference prevention | `Self-reference` |
| Parent uniqueness | `Duplicate parents` |
| Parent resolution | `Missing parents` |
| Acyclicity | `Cycle detected` |

---

## Related Documents

- [`../data-model.md`](../data-model.md) — Block, GraphResult, and Trace field definitions
- [`../operations.md`](../operations.md) — `validateLineage`, `validateGraph`, and `verifyGraph` operations
- [`canonical-envelope.md`](./canonical-envelope.md) — how `parentHashes` participates in `blockHash` derivation
- [`invariants.md`](./invariants.md) — lineage and acyclicity invariants
- [`../../protocol/spec.md`](../../protocol/spec.md) — normative protocol behavior

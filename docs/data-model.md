# Data Model

ALX Protocol data structures defined by the specification and schemas. New protocol behavior remains outside the scope of the data model document.

---

## Purpose

Human-readable reference for all protocol data structures. For machine-readable schemas, see [`protocol/schemas/`](../protocol/schemas/).

---

## Block

The ALX Protocol primitive — artifact content and parent lineage bound into a deterministic blockHash.

| Field | Type | Required | Description |
|---|---|---|---|
| `blockHash` | `string` | Yes | `keccak256(canonicalize({ content, parentHashes }))`. Lowercase `0x`-prefixed 64-char hex. |
| `contentHash` | `string` | Yes | `keccak256(canonicalize(content))`. Lowercase `0x`-prefixed 64-char hex. |
| `parentHashes` | `string[]` | Yes | Sorted, deduplicated, lowercase parent `blockHash` values. Empty array for root blocks. |
| `content` | `any` | Yes | Any JSON-serializable value. Opaque to the protocol. `null` if absent. |

**Constraints:**
- `blockHash` MUST equal `keccak256(canonicalize({ content, parentHashes }))` after parent normalization
- `contentHash` MUST equal `keccak256(canonicalize(content))`
- `parentHashes` MUST be normalized: lowercase, deduplicated, sorted lexicographically, invalid entries dropped
- `content` passes through as-is after null-coalescing (`undefined` -> `null`)
- Same `content` + same `parentHashes` MUST always produce the same `blockHash`

**Relationships:**
- A Block references zero or more parent Blocks via `parentHashes`
- Parent references form a directed acyclic Graph (Graph)
- A Block with empty `parentHashes` is a root (leaf in attribution terms)

**Schema:** [`protocol/schemas/block.schema.json`](../protocol/schemas/block.schema.json)

---

## Hash Format

All hashes in the protocol follow the same format.

| Property | Value |
|---|---|
| Algorithm | Keccak-256 (NOT SHA3-256) |
| Prefix | `0x` |
| Length | 66 characters total (2 prefix + 64 hex) |
| Case | Lowercase only |
| Pattern | `/^0x[a-f0-9]{64}$/` |

**Common mistake:** Using SHA3-256 (`sha3.New256()` in Go, `hashlib.sha3_256` in Python) instead of Keccak-256. SHA3-256 and Keccak-256 produce different outputs. Use the Ethereum-compatible Keccak variant.

---

## AttributionTrace

The result of tracing attribution from a root block through a graph.

| Field | Type | Description |
|---|---|---|
| `root` | `string` | The `blockHash` from which attribution traces |
| `nodes` | `TraceNode[]` | All blocks reachable from root, sorted by minDepth then hash |
| `edges` | `TraceEdge[]` | All edges among reachable nodes, sorted by from then to |
| `leaves` | `string[]` | Nodes with no parents (original sources), sorted lexicographically |
| `maxDepth` | `number` | Maximum depth reached during traversal |
| `cycle` | `boolean` | Whether traversal encountered a cycle |

**Schema:** [`protocol/schemas/attribution-trace.schema.json`](../protocol/schemas/attribution-trace.schema.json)

---

## TraceNode

A single node in an attribution trace.

| Field | Type | Description |
|---|---|---|
| `hash` | `string` | `blockHash` of the traced Block |
| `minDepth` | `number` | Shortest path length from root to the traced node |
| `maxDepth` | `number` | Longest path length from root to the traced node |
| `pathCount` | `number` | Number of distinct paths from root to the traced node (exact, via topological propagation) |
| `parentCount` | `number` | Number of direct parents of the traced node |
| `childCount` | `number` | Number of blocks that reference the traced node as a parent |

**Key property:** `pathCount` is the primary attribution metric. Higher pathCount means more paths depend on the traced node.

---

## TraceEdge

A directed edge in an attribution trace.

| Field | Type | Description |
|---|---|---|
| `from` | `string` | Child `blockHash` (the Block that declares a parent in `parentHashes`) |
| `to` | `string` | Parent `blockHash` (the Block referenced in `parentHashes`) |

---

## BlockAttestation

An EIP-712 signature attesting to a block. Orthogonal to block identity - signing preserves `blockHash`.

| Field | Type | Description |
|---|---|---|
| `blockHash` | `string` | The `blockHash` being attested |
| `attester` | `string` | Ethereum address of the signer (lowercase) |
| `timestamp` | `number` | Unix timestamp of the attestation |
| `signature` | `string` | EIP-712 typed data signature |

---

## LineageResult

Result of validating a single block's lineage.

| Field | Type | Description |
|---|---|---|
| `ok` | `boolean` | Whether lineage is valid |
| `blockHash` | `string` | The block under validation |
| `parents` | `string[]` | Normalized parent hashes |
| `duplicates` | `string[]` | Parent hashes that appeared more than once (pre-normalization) |
| `missing` | `string[]` | Parent hashes absent from the known set |
| `selfRef` | `boolean` | Whether the block references itself |
| `cycle` | `boolean` | Whether traversal encountered a cycle |

---

## GraphResult

Result of validating an entire block graph.

| Field | Type | Description |
|---|---|---|
| `ok` | `boolean` | Whether the graph is structurally valid |
| `blocks` | `number` | Number of blocks in the graph |
| `edges` | `number` | Number of parent references |
| `roots` | `string[]` | Blocks with no parents |
| `issues` | `LineageResult[]` | Blocks with validation problems |

---

## Related Documents

- [`protocol/schemas/`](../protocol/schemas/) — machine-readable Block, Trace, and context schemas
- [`operations.md`](./operations.md) — operations that consume the data structures above
- [`deep-dives/canonical-envelope.md`](./deep-dives/canonical-envelope.md) — canonical envelope and hash derivation
- [`deep-dives/lineage.md`](./deep-dives/lineage.md) — Graph validation and `parentHashes` rules
- [`protocol/spec.md`](../protocol/spec.md) — normative protocol behavior

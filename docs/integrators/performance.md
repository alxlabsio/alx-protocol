# Performance Guide

The document describes practical performance considerations for ALX Protocol-based systems. Performance guidance remains outside the protocol specification.

---

## Purpose

Covers the computational cost of ALX operations and optimization patterns for common workloads.

## Scope

Covers algorithmic complexity, practical throughput expectations, and optimization patterns for the TypeScript SDK.

## Non-Goals

Excludes storage-layer performance (database tuning, content-addressed repository pinning speed) and on-chain gas costs (see contract documentation).

---

## Operation Costs

| Operation | Time complexity | Space complexity | Notes |
|-----------|----------------|------------------|-------|
| `canonicalizeProtocolJson` | O(n log n) | O(n) | n = total number of keys across all nested objects (sort-dominated) |
| `deriveBlockHash` | O(n log n + m) | O(n) | n = canonicalization cost, m = canonical string length for keccak-256 |
| `deriveContentHash` | O(n log n + m) | O(n) | Same as above, without parent hashes |
| `createBlock` | O(n log n + m) | O(n) | Two hash derivations + normalization |
| `validateBlock` | O(n log n + m) | O(n) | One hash derivation + comparison |
| `normalizeHashes` | O(k log k) | O(k) | k = number of parent hashes |
| `validateLineage` | O(k) | O(k) | k = number of parents |
| `validateGraph` | O(V + E) | O(V + E) | V = blocks, E = parent references |
| `buildGraph` | O(V * k) | O(V + E) | k = average parents per Block |
| `verifyGraph` | O(V * (n log n + m)) | O(V + E) | Hash recomputation per Block |
| `traceAttribution` | O(V + E) | O(V + E) | DFS + BFS + topological sort |
| `buildMerkleTree` | O(L log L) | O(L log L) | L = number of leaves |
| `getMerkleProof` | O(L log L) | O(log L) | Rebuilds tree internally |
| `verifyMerkleProof` | O(log L) | O(1) | Proof verification only |

---

## Practical Throughput

Approximate throughput on a modern machine (Node.js 20, single-threaded):

| Operation | Small content (~100 bytes) | Medium content (~10 KB) | Large content (~1 MB) |
|-----------|---------------------------|-------------------------|----------------------|
| `createBlock` | ~50,000 ops/sec | ~15,000 ops/sec | ~200 ops/sec |
| `validateBlock` | ~50,000 ops/sec | ~15,000 ops/sec | ~200 ops/sec |

| Graph operation | 100 Blocks | 10,000 Blocks | 1,000,000 Blocks |
|----------------|------------|---------------|-----------------|
| `validateGraph` | < 1 ms | ~10 ms | ~1 sec |
| `traceAttribution` | < 1 ms | ~10 ms | ~1 sec |
| `verifyGraph` | ~2 ms | ~200 ms | ~20 sec |

These are order-of-magnitude estimates. Actual performance depends on content structure, Graph density, and hardware.

---

## Optimization Patterns

### Batch Block Creation

If creating many Blocks with the same parents, reuse the normalized parent array:

```js
import { createBlock, normalizeHashes } from "@alx-protocol/sdk";

const parents = normalizeHashes([parentHash1, parentHash2]);
const blocks = items.map(item => createBlock(item, parents));
```

### Graph Caching

`buildGraph` creates a `Map` from an array of Blocks. When the Block set changes incrementally, maintain the `Map` directly instead of rebuilding:

```js
const graph = new Map();

function addBlock(block) {
  graph.set(block.blockHash, block.parentHashes);
}

function removeBlock(blockHash) {
  graph.delete(blockHash);
}
```

### Incremental Graph Validation

For large Graphs that grow over time, validate only the new portion:

```js
import { validateLineage } from "@alx-protocol/sdk";

function validateNewBlock(block, knownHashes) {
  return validateLineage(block.blockHash, block.parentHashes, knownHashes);
}
```

Full `validateGraph` applies when cycle detection must run across the entire Graph.

### Pre-Built Merkle Trees For Batch Proofs

`getMerkleProof` rebuilds the tree on each call. For multiple proofs from the same leaf set, build the tree once:

```js
import { buildMerkleTree } from "@alx-protocol/sdk";

const tree = buildMerkleTree(allLeaves);
// Use tree.layers to extract proofs manually, or call getMerkleProof
// which rebuilds internally (consider caching for hot paths).
```

### Content Size Management

Canonicalization and hashing scale with content size. For large content payloads, consider:

- Store large payloads externally and reference each payload by hash in the Block content
- Splitting large documents into multiple Blocks linked by parentHashes
- Using `contentHash` for deduplication before creating Blocks

---

## Memory Considerations

### Large Graph Handling

`traceAttribution` and `validateGraph` hold the entire reachable Graph in memory. For Graphs with millions of nodes, ensure sufficient heap space:

```bash
node --max-old-space-size=4096 path/to/script.js
```

Deep linear chains (each Block with one parent) can exceed the default JavaScript call stack during recursive cycle detection at roughly 10,000 nodes. Wide Graphs (fan-out and fan-in) tolerate larger node counts without stack exhaustion. For production workloads beyond 5,000 nodes in a single linear chain, prefer an iterative cycle-detection implementation or validate incrementally with `validateLineage`.

### Streaming Patterns For Bulk Operations

When processing large Block sets from a database, stream rather than loading all at once:

```js
const graph = new Map();
const cursor = db.query("SELECT block_hash, parent_hashes FROM blocks");

for await (const row of cursor) {
  graph.set(row.block_hash, JSON.parse(row.parent_hashes));
}

// Now trace from any root
const trace = traceAttribution(rootHash, graph);
```

### Content Serialization Overhead

`canonicalizeProtocolJson` creates intermediate strings during recursion. For deeply nested content (approaching the 128-level limit), memory usage scales with depth. Flatten nested structures where possible.

---

## Related Documents

- [`./api-reference.md`](./api-reference.md) - SDK API reference
- [`./deployment-checklist.md`](./deployment-checklist.md) - production readiness
- [`./database-guide.md`](./database-guide.md) - database schema and queries
- [`../../protocol/spec.md`](../../protocol/spec.md) - normative specification

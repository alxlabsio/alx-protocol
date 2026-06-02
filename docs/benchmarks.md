# Performance Benchmarks

Audience: integrators, implementers

This document covers the performance characteristics of ALX Protocol core operations. Numbers reflect the TypeScript SDK on a single-core workload. Run the harness locally to get platform-specific numbers.

---

## Running The Harness

```bash
# Step 1 — build the TypeScript SDK
cd sdk
npm install && npm run build
cd ../..

# Step 2 — run the benchmark harness
node scripts/bench/run.js

# Tighter p99 estimates (more iterations)
node scripts/bench/run.js --iterations 5000

# Machine-readable output for CI or dashboards
node scripts/bench/run.js --json
```

---

## Reference Platform

Numbers below were recorded on this platform. Measurements on Linux CI or ARM hardware will differ.

| Property | Value |
|---|---|
| OS | Windows 10 Pro x64 |
| Node.js | v20.20.2 |
| Architecture | x64 |
| Harness | `scripts/bench/run.js` |
| Default iterations | 1,000 (graph ops fewer; see table) |

---

## Measurement Methodology

| Property | Value |
|---|---|
| Timer | `performance.now()` (sub-millisecond resolution) |
| Warmup | 50 iterations before recording begins (JIT prime) |
| Reported metrics | p50 (median), p99 (99th percentile) |
| Input sizes | Small, medium, large — defined in `scripts/bench/run.js` |

All measurements are single-threaded. No I/O, network, or filesystem access during measurement.

---

## Canonicalization

Recursive deterministic JSON serialization. Complexity scales with field count and nesting depth.

| Input | Fields (approx) | p50 | p99 |
|---|---|---|---|
| Small (5 fields, flat) | 5 | 12 µs | 55 µs |
| Medium (3-level, 4-wide) | ~85 | 176 µs | 745 µs |
| Large (4-level, 4-wide) | ~341 | 552 µs | 2.8 ms |

**Scaling:** O(n log n) in field count — key sorting at each object level. Nesting depth adds recursion overhead linearly.

---

## Hash Derivation

Keccak-256 over a canonicalized string. Parent count affects the pre-hash canonicalization cost.

| Operation | Config | p50 | p99 |
|---|---|---|---|
| `deriveBlockHash` | 0 parents | 36 µs | 1.1 ms |
| `deriveBlockHash` | 10 parents | 111 µs | 865 µs |
| `deriveBlockHash` | 256 parents (max) | 1.9 ms | 6.5 ms |
| `deriveContentHash` | Large content (~341 fields) | 1.5 ms | 5.9 ms |

**Scaling:** O(p) in parent count after deduplication. Canonicalization dominates over the keccak-256 computation.

---

## Graph Validation

Full DAG traversal checking for cycles and missing parents. Complexity is linear in graph size.

| Graph size | p50 | p99 | Iterations |
|---|---|---|---|
| 100 nodes | 294 µs | 2.8 ms | 500 |
| 1,000 nodes | 3.2 ms | 7.4 ms | 100 |
| 5,000 nodes | 24.3 ms | 45.6 ms | 20 |

**Scaling:** O(V + E) — visits each vertex and edge once. Memory is O(V) for the visited-set.

---

## Attribution Trace

DFS traversal computing `pathCount` per node. Same complexity class as graph validation with an additional linear pass for path accumulation.

| Graph size | p50 | p99 | Iterations |
|---|---|---|---|
| 100 nodes | 647 µs | 3.7 ms | 500 |
| 1,000 nodes | 8.0 ms | 34.0 ms | 100 |
| 5,000 nodes | 60.5 ms | 355 ms | 20 |

**Scaling:** O(V + E). The 5,000-node p99 variance reflects the small sample size (20 iterations) — p50 is the stable metric at this scale.

**Practical ceiling:** The recursive DFS implementation reaches the default Node.js call stack limit at approximately 7,000–10,000 nodes on a linear chain. Real-world agent graphs are wide (high branching factor) rather than deep, so stack depth stays bounded in practice. Cache `traceAttribution` results keyed on the root `blockHash` — the trace is deterministic and changes only when the graph changes.

---

## Protocol Limits And Worst-Case Input

| Limit | Value | Defined in |
|---|---|---|
| Max canonicalization depth | 128 levels | `protocol/limits.json` LIMIT-002 |
| Max canonical output size | 16 MB | `protocol/limits.json` LIMIT-101 |
| Max parents per Block | 256 (post-dedup) | `protocol/limits.json` LIMIT-001 |

A Block at the theoretical maximum (128-level nesting, 256 parents) represents the worst-case input for any implementation. Conformance depth vectors are in `protocol/test-vectors/canonicalization-depth.json`.

---

## Interpreting Results

| Scenario | Key metric |
|---|---|
| Inline Block creation in a hot path | `deriveBlockHash` p50 |
| Validating a batch of Blocks on arrival | `deriveBlockHash` p99 × batch size |
| Loading and validating a large agent graph | `validateGraph` p50 at graph size |
| Trace queries on a live attribution graph | `traceAttribution` p50 at graph size; cache results |

---

## Related Documents

- `[scripts/bench/run.js](../scripts/bench/run.js)` — benchmark harness source
- `[protocol/limits.json](../protocol/limits.json)` — normative protocol limits
- `[protocol/test-vectors/canonicalization-depth.json](../protocol/test-vectors/canonicalization-depth.json)` — depth boundary vectors
- `[docs/operations.md](operations.md)` — operation reference

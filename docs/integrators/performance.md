# Performance And Resource Planning

This guide describes safe performance practices for ALX-based applications. It does not define protocol behavior or publish benchmark claims.

## Measure Your Workload

Canonicalization cost grows with the size and nesting of `content`. Graph work grows with the reachable Blocks and declared parent relationships examined within a Verification Context. Actual throughput depends on runtime, implementation, content shape, Graph shape, cryptographic backend, and storage latency.

Do not use undocumented operations-per-second figures as capacity targets. Benchmark the released version with representative Blocks, parent density, traversal modes, and failure cases, and record the hardware and command used.

## Bound Graph Verification

Use the canonical three-input operation:

```ts
const result = validateGraph(seed, source, {
  protocolVersion: "1",
  graphRoot: seed.blockHash,
  validationMode: "closed-world",
  resourceLimits: {
    maxNodes: 10_000,
    maxEdges: 40_000,
  },
});
```

Choose limits from application risk and service capacity. When a declared budget stops verification before a violation is found, the result is `resource_limit_reached`; it must not be reported as `valid`. Missing required Block data produces `incomplete` when no known violation takes precedence.

The portable Graph operation uses a finite Block source. A production indexer or store can adapt its lookup boundary to that contract, but pagination, caching, retries, and distributed discovery remain application behavior.

## Ingestion

For a new Block:

1. parse untrusted JSON strictly;
2. validate the complete Block;
3. apply the application's availability and admission policy;
4. persist all five core fields without changing their values; and
5. run scoped Graph verification when the workflow requires an ancestry claim.

`validateIncrementalBlock` can check a new Block against a caller-supplied, already validated Graph. It is an optimization with explicit preconditions, not a substitute for complete validation of an unknown or partially trusted store. Use the canonical Graph operation for scoped results with availability and resource-limit semantics.

## Caching And Deduplication

- Cache by `blockHash` only after validating the complete Block.
- Use `contentHash` to locate equal content, not to identify a full Block.
- Treat a hash collision or two nonidentical candidates claiming one `blockHash` as a security event; do not silently keep one.
- Invalidate application caches when their index scope or verification context changes.
- Keep receipts separate from current validity: a receipt records a prior run and does not prove the store is unchanged.

## Large Content And Graphs

- Measure canonicalization memory as well as CPU for large or deeply nested ALX values.
- Keep large external payloads behind an application-defined content reference when that better fits the product; the reference convention is not defined by core ALX.
- Stream storage reads where possible, but materialize the deterministic finite source required for a portable conformance request.
- Prefer iterative traversal in application implementations that must tolerate deep chains.
- Set service request, byte, node, and edge budgets before accepting public traffic.

## Benchmark Evidence

A publishable benchmark should include the repository revision, runtime and dependency versions, hardware, operating system, command, corpus or generator, warm-up method, sample count, and distribution statistics. Keep measured reports versioned separately from normative documentation so they can be updated without implying a protocol guarantee.

## Related Documents

- [`./api-reference.md`](./api-reference.md) — TypeScript SDK surface
- [`./deployment-checklist.md`](./deployment-checklist.md) — production readiness
- [`./database-guide.md`](./database-guide.md) — storage patterns
- [`../../GRAPH.md`](../../GRAPH.md) — Graph semantics
- [`../../protocol/schemas/verification-context.schema.json`](../../protocol/schemas/verification-context.schema.json) — context shape

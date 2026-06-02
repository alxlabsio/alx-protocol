# ADR-005: Incremental Validation For Streaming Block Graphs

This architecture decision records how ALX Protocol enables efficient validation for streaming Block graphs, real-time agent workflows, artifact pipelines, and high-throughput product backends.

---

**Date:** 2026-05-11

## Context

ALX Protocol applications may create Blocks continuously across agent systems, developer tools, research workflows, CI pipelines, artifact registries, and product backends. In these environments, Blocks often arrive one at a time as work progresses.

The existing `validateGraph()` operation validates a complete graph in `O(V + E)` time, where `V` is the number of Blocks and `E` is the number of parent references. This model supports batch review, audits, package verification, and full-graph conformance checks.

Streaming workflows benefit from an additional validation path that checks each new Block against an already validated graph. This allows products to verify Blocks during ingestion while preserving the same graph-validity rules used by full validation.

## Decision

Add `validateIncrementalBlock(block, existingGraph)`.

This operation validates one new Block against an existing validated graph in `O(k)` time, where `k` is the number of parent references on the new Block.

The incremental validation result MUST be equivalent to the result produced by `validateGraph()` over the combined graph.

## Rationale

1. **Streaming product workflows.** Agent systems, artifact pipelines, developer tools, and backend services often create Blocks one at a time. Incremental validation gives these systems a real-time verification path.

2. **Full-validation equivalence.** Incremental validation preserves the same validity model as full graph validation. The optimization changes execution strategy while preserving protocol expectations and graph invariants.

3. **Stateless validator design.** The validator checks the new Block against the provided graph and returns a validation result. Caller-owned buffering handles out-of-order Blocks, missing parents, retries, and ingestion policy.

4. **High-throughput readiness.** `O(k)` validation allows the cost of validating each new Block to scale with the new Block’s parent references.

5. **Clear application boundary.** ALX Protocol validates Block and graph correctness. Applications own queueing, retry behavior, persistence, ingestion order, and operational policy.

6. **Testable correctness.** The equivalence between incremental validation and full validation can be captured in conformance tests and regression suites.

## Design Options Reviewed

- **Incremental validation against an existing validated graph:** Supports streaming workflows, efficient graph growth, and testable equivalence with full graph validation. ALX selects this model for real-time graph validation.

- **Full graph validation after every new Block:** Provides complete validation through the existing operation. ALX keeps `validateGraph()` for batch review, audits, package verification, and full-graph conformance checks.

- **Deferred batch validation:** Validates Blocks after ingestion. ALX supports batch validation through `validateGraph()` and adds incremental validation for immediate verification during ingestion.

- **Validator-owned orphan management:** Tracks missing-parent Blocks inside the validator. ALX keeps the validator stateless so applications can implement buffering, retries, and operational policy in the product layer.

## Consequences

- `validateIncrementalBlock(block, existingGraph)` validates one new Block against an existing validated graph in `O(k)` time.

- Parent references are checked against the existing graph.

- Cycle detection runs from the new Block’s parent references toward the new Block hash.

- Out-of-order Blocks with missing parents return a validation failure that callers can buffer, resolve, and retry.

- `addBlockToGraph` mutates the graph in place. Callers that require immutable graph handling should copy the graph before insertion.

- The invariant `incremental result === full result` MUST be verified in the test suite.

- Conformance and regression tests should include equivalent full-validation and incremental-validation cases across valid graphs, missing-parent cases, duplicate-parent cases, and cycle attempts.

## Related Documents

- [`../protocol/spec.md`](../protocol/spec.md)
- [`../deep-dives/lineage.md`](../deep-dives/lineage.md)
- [`../implementers/conformance.md`](../implementers/conformance.md)
- [`../integrators/agent-integration.md`](../integrators/agent-integration.md)
- [`../integrators/workflows.md`](../integrators/workflows.md)

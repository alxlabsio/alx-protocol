# ADR-011: Graph Validation Outcomes

## Status

Accepted and implemented for ALX Protocol v1. TypeScript, Python, and Rust pass the canonical Graph outcome suites and the cross-language differential gate.

## Context

The earlier Graph model used Boolean `ok` results and classified unavailable required parents as invalid in closed-world validation. That collapsed four different facts:

- a definite protocol violation was found;
- required Block data was unavailable;
- execution stopped because a verifier exhausted a resource budget;
- Graph validation was never requested.

Those facts support different claims and must not be interchangeable. Block validity also remains independent from the availability and verification status of the surrounding Graph.

## Decision

An attempted Graph validation has exactly one status:

```text
valid
invalid
incomplete
resource_limit_reached
```

`not_checked` is not a status. A workflow that records whether Graph validation occurred uses `checked: false` and omits `status`. A direct Graph validation result uses `checked: true`.

The normative meanings are:

| Status | Meaning |
|---|---|
| `valid` | Every check required by the exact verification context completed and no violation was found. |
| `invalid` | At least one definite protocol violation was found. |
| `incomplete` | No violation was found, but required syntactically valid parent Block data was unavailable. |
| `resource_limit_reached` | No violation was found, but a resource budget stopped validation before all required checks completed. |

Outcome precedence is:

```text
invalid > resource_limit_reached > incomplete > valid
```

Known invalidity is never erased by missing data or later budget exhaustion. Missing data and budget exhaustion never establish invalidity without an independent protocol violation.

Closed-world mode requires all in-scope parent Blocks. An unavailable syntactically valid parent therefore produces `incomplete`, not `invalid`, unless a higher-precedence condition applies.

Open-world mode permits explicitly declared external parents outside the required scope. A Graph can therefore be `valid` within its open-world context while listing unresolved `externalParents`. An undeclared unavailable parent remains required data and produces `incomplete` unless a higher-precedence condition applies.

`maxDepth` is an intentional claim boundary. It is not a resource limit. A `valid` depth-bounded result claims only the checks at or within that depth. `resourceLimits.maxBlocks` and `resourceLimits.maxEdges` are inclusive execution budgets; needing to exceed either produces `resource_limit_reached` unless known invalidity takes precedence.

Traversal is deterministic breadth-first traversal from the supplied seed. Blocks at the same depth and parent declarations are ordered by ascending normalized hash. Blocks are counted when their data is examined; parent declarations are counted as edges when considered, including declarations that cross a `maxDepth` boundary. Budgets are checked before the next Block or edge is examined. The seed must be supplied and match `context.graphRoot`; failure to do so is a malformed request rather than an `incomplete` Graph.

The normative operation is `validateGraph(seed, source, context)`. The seed is a complete root Block candidate. The source is a local deterministic lookup boundary that returns zero, one, or multiple complete Block candidates for a requested normalized identity. Only candidates requested through reachable, in-scope relationships are examined; unrelated source entries cannot affect the result. Portable vectors encode the source as an order-independent finite Block collection while preserving duplicates for diagnosis.

Checked results use the complete canonical Graph verification envelope. Graph issues contain only the normative `code` and attributed normalized `blockHash`; human-readable messages remain outside the canonical result. Issues are deduplicated by `(blockHash, code)` and sorted by `blockHash`, then `code`. Exact result comparison is required for Graph conformance so missing fields, extra fields, different counts, different diagnostics, and different ordering all fail.

The result must echo the exact verification context. Graph results are not Blocks and have no protocol identity.

## Consequences

- Existing Boolean Graph results and verification receipts were migrated to the status model.
- `ALX_MISSING_PARENT` and `ALX_EXTERNAL_PARENT_UNDECLARED` become availability diagnostics rather than protocol-invalid findings.
- Existing vectors that expected missing parents to produce `ok: false` were superseded by outcome vectors.
- TypeScript, Python, and Rust Graph implementations changed together after the normative vectors were frozen.
- Explorer and application interfaces can distinguish a valid Block from an incomplete, resource-limited, or unrequested Graph validation.

## Compatibility

This was a breaking prerelease correction to Graph validation semantics. It does not change Block structure, canonicalization, `contentHash`, `blockHash`, or normalized `parentHashes`. The correction is incorporated into the ALX Protocol v1 release target rather than changing a previously published protocol version.

## Exit Gate

Complete. The normative operation inputs, status meanings, precedence, availability rules, context scope, resource-limit behavior, result schemas, and vectors form one coherent change. TypeScript, Python, and Rust implement the model and pass structural, conformance, interaction, and cross-language differential gates.

## Related Documents

- [`../../protocol/spec.md`](../../protocol/spec.md)
- [`../../protocol/schemas/graph-verification.schema.json`](../../protocol/schemas/graph-verification.schema.json)
- [`../../protocol/schemas/graph-validation-request.schema.json`](../../protocol/schemas/graph-validation-request.schema.json)
- [`../../protocol/schemas/verification-context.schema.json`](../../protocol/schemas/verification-context.schema.json)
- [`../../test-vectors/graphs/graph-validation-outcomes.json`](../../test-vectors/graphs/graph-validation-outcomes.json)
- [`./009-graph-validation-model.md`](./009-graph-validation-model.md)
- [`./010-security-boundary-contract.md`](./010-security-boundary-contract.md)

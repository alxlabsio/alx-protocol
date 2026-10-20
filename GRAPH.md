# Graph and Trace

Status: public topic map; normative rules remain in the canonical sources

An ALX Graph is the connected Block structure reachable through declared
`parentHashes` within a verification context. Complete lineage, Graph
validation, traversal, outcome, precedence, ordering, and limit rules are in
[`protocol/spec.md`, sections 4 and 5](./protocol/spec.md#4-lineage).

## Canonical sources

| Material | Purpose |
|---|---|
| [`protocol/spec.md`, section 4](./protocol/spec.md#4-lineage) | Parent resolution, Graph validity, traversal, outcomes, precedence, scope, and budgets |
| [`protocol/spec.md`, section 5](./protocol/spec.md#5-attribution) | Canonical Trace structure and computation |
| [`protocol/schemas/graph-validation-request.schema.json`](./protocol/schemas/graph-validation-request.schema.json) | Portable finite-source Graph request |
| [`protocol/schemas/graph-verification.schema.json`](./protocol/schemas/graph-verification.schema.json) | Complete canonical Graph result |
| [`protocol/schemas/attribution-trace.schema.json`](./protocol/schemas/attribution-trace.schema.json) | Canonical Trace result |
| [`test-vectors/graphs/`](./test-vectors/graphs/) | Outcomes, interactions, boundaries, ordering, Graph, and Trace cases |

## Layer boundary

`parentHashes` are declared protocol facts contained in a Block. A reverse
child relationship is derived by an indexer from observed Blocks; it is not a
stored Block field and does not alter protocol identity.

Indexes and Explorers may provide discovery, reverse child lookup, bounded
neighborhoods, availability observations, pagination, and visualization. Those
results are application-layer views unless they exactly satisfy a canonical
Graph or Trace result schema.

## Verification model

Block validation and Graph validation are separate claims. A valid Block may
belong to an incomplete or resource-bounded Graph result. Unavailable required
data and resource exhaustion do not independently establish protocol
invalidity.

## Related documents

- [`IDENTITY.md`](./IDENTITY.md)
- [`CONFORMANCE.md`](./CONFORMANCE.md)
- [`docs/architecture.md`](./docs/architecture.md)
- [`docs/threat-model.md`](./docs/threat-model.md)

# Creating Attributed Outputs

The document describes the attribution-first workflow for producing outputs with verifiable, attributable provenance. Attribution workflows remain outside the protocol specification.

---

## The Problem

Outputs produced by pipelines, agents, and teams carry no verifiable record of contributing inputs. When a downstream consumer receives an output — a recommendation, a report, a generated response — the sources, proportions, and post-production integrity are unverifiable.

ALX Protocol addresses attribution through a three-block workflow: root blocks for sources, parent blocks for derivations, output blocks with full attribution.

---

## The Attribution Workflow

### Step 1 — Root Blocks: Verified Sources

Create a Block for each source. Root blocks have no parents.

```ts
import { createBlock } from "@alx-protocol/sdk";

const sourceA = createBlock({
  type: "document",
  title: "Q4 market analysis",
  text: "AI infrastructure spending grew 47% year-over-year...",
});

const sourceB = createBlock({
  type: "document",
  title: "Customer interviews",
  text: "Customers reported latency as the primary concern...",
});
```

Each root block has a deterministic `blockHash` derived from its content. The same content always produces the same hash. If the content changes, the hash changes.

---

### Step 2 — Parent Blocks: Intermediate Derivations

Create a Block for each intermediate processing step. Reference the root blocks as parents.

```ts
const synthesis = createBlock(
  {
    type: "synthesis",
    text: "Market growth and latency concerns both point to infrastructure demand...",
  },
  [sourceA.blockHash, sourceB.blockHash]
);
```

`parentHashes` are normalized, sorted, and deduplicated by the SDK. Caller-supplied parent order has no effect on the `blockHash`.

---

### Step 3 — Output Block: The Final Artifact

Create the output Block, referencing its direct parents. In many workflows the output references a synthesis block. When the output also draws directly from a root source, include both parents.

```ts
const output = createBlock(
  {
    type: "recommendation",
    text: "Increase infrastructure allocation by 20% in Q1.",
  },
  [synthesis.blockHash, sourceA.blockHash]
  // synthesis covers sourceA + sourceB; sourceA is also referenced directly
);
```

---

### Step 4 — Attribution Trace From Output To Sources

```ts
import { buildGraph, traceAttribution } from "@alx-protocol/sdk";

const graph = buildGraph([sourceA, sourceB, synthesis, output]);
const trace = traceAttribution(output.blockHash, graph);
```

The trace returns:

| Field | Meaning |
|---|---|
| `complete` | `true` if all parent references resolve within the graph |
| `nodes` | Every reachable block with `pathCount` and `minDepth` |
| `edges` | Every parent-child link in the graph |
| `leaves` | Blocks with no parents (the root sources) |
| `maxDepth` | Longest chain from output to a root block |

---

## The Quality Signal

A high-quality attributed output satisfies two criteria.

### Criterion 1 — Completeness

`trace.complete === true` means every `parentHash` in the graph resolves to a known Block. No phantom parents. No unresolved lineage.

When a source cannot be included locally, declare the source as an external parent using open-world validation:

```ts
const context = {
  validationMode: "open-world",
  externalParents: [{ blockHash: "0xabc...", reason: "proprietary dataset, not redistributable" }],
};
```

An open-world trace reports `complete: false` when resolution is partial, while `externalParents` remains explicit. The lineage boundary is declared rather than hidden.

### Criterion 2 — pathCount Distribution

`pathCount` is the number of distinct paths from the output to a given source through the derivation graph.

```
output → synthesis → sourceA   (path 1 to sourceA)
output → sourceA               (path 2 to sourceA)
output → synthesis → sourceB   (path 1 to sourceB)
```

| Block | pathCount | Interpretation |
|---|---|---|
| sourceA | 2 | Referenced by two independent derivation paths — deeply embedded |
| sourceB | 1 | Referenced through synthesis only — contributes once |
| synthesis | 1 | One path from output |

A higher `pathCount` means a source is more deeply embedded in the output's derivation. When reviewing a flagged output, start with the highest `pathCount` source.

**Reading pathCounts in the trace:**

```ts
for (const node of trace.nodes) {
  console.log(`${node.hash.slice(0, 10)}  pathCount=${node.pathCount}  depth=${node.minDepth}`);
}
// 0xout...     pathCount=1  depth=0
// 0xsynth...   pathCount=1  depth=1
// 0xsourceA... pathCount=2  depth=1
// 0xsourceB... pathCount=1  depth=2
```

---

## Verifying The Output

Before trusting a received output, validate the output Block:

```ts
import { validateBlock } from "@alx-protocol/sdk";

const result = validateBlock(output);
console.log(result.ok); // true if blockHash matches recomputed hash

if (!result.ok) {
  // output was tampered with after creation
  console.log("Expected:", result.expected);
  console.log("Actual:", result.actual);
}
```

`validateBlock` recomputes `keccak256(canonicalize({ content, parentHashes }))` and compares the result to the stored `blockHash`. The operation is local — no network, no external service.

---

## Packaging As A Verification Receipt

A verification receipt captures the attribution result in a portable JSON document that downstream consumers can use without access to the original SDK.

```ts
// The receipt records: block identity, validation mode, completeness,
// missing parents, external parents, and whether CID was verified.
// Use the CLI to generate and verify receipts:
// alx package verify artifact-packages/security-review-decision --json
```

See [`verification-receipts.md`](./verification-receipts.md) for the receipt format.

---

## Complete Example

```ts
import {
  createBlock,
  validateBlock,
  buildGraph,
  traceAttribution,
} from "@alx-protocol/sdk";

// Root blocks — verified sources
const sourceA = createBlock({ type: "document", text: "Market analysis data" });
const sourceB = createBlock({ type: "document", text: "Customer interview notes" });

// Parent block — synthesis
const synthesis = createBlock(
  { type: "synthesis", text: "Insights from market and customer data" },
  [sourceA.blockHash, sourceB.blockHash]
);

// Output block — references synthesis and sourceA directly
const output = createBlock(
  { type: "recommendation", text: "Increase infrastructure allocation by 20%" },
  [synthesis.blockHash, sourceA.blockHash]
);

// Validate — confirm no tampering
const valid = validateBlock(output);
console.log("Valid:", valid.ok); // true

// Attribution trace
const graph = buildGraph([sourceA, sourceB, synthesis, output]);
const trace = traceAttribution(output.blockHash, graph);

console.log("Complete:", trace.complete);  // true
console.log("Leaves:", trace.leaves);      // [sourceA.blockHash, sourceB.blockHash]

for (const node of trace.nodes) {
  console.log(`${node.hash.slice(0, 18)}  pathCount=${node.pathCount}`);
}
// output:    pathCount=1
// synthesis: pathCount=1
// sourceA:   pathCount=2  ← referenced by two paths
// sourceB:   pathCount=1
```

---

## Related Documents

- [`quickstart.md`](./quickstart.md) — zero-to-working integration
- [`agent-integration.md`](./agent-integration.md) — attribution in agent workflows
- [`verification-receipts.md`](../verification-receipts.md) — portable receipt format
- [`../../protocol/spec.md`](../../protocol/spec.md) — normative specification
- [`../../artifact-packages/START-HERE.md`](../../artifact-packages/START-HERE.md) — canonical package examples

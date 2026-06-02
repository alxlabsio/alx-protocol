# Quickstart

The quickstart describes install, Block creation, validation, attribution tracing, persistence, and artifact package verification.

---

## Concepts

### Content Addressing

A content-addressed identifier names data by a digest of the data bytes. ALX Protocol derives Block identity from canonicalized content and parent references. The storage layer may hold Block JSON in a database, a file, or a content-addressed repository. The verification result is independent of storage location.

### Canonicalization

Canonicalization is deterministic serialization of JSON values to UTF-8 bytes. ALX Protocol defines ordering rules for object keys, number encoding, and rejection of non-finite numbers. Two implementations that apply the same canonicalization rules to the same input produce identical bytes. Identical bytes produce identical hashes.

### Hash Function

ALX Protocol version 1 uses Keccak-256. The digest length is 32 bytes. The on-wire form is a lowercase `0x`-prefixed string of 64 hexadecimal characters. SHA3-256 is a different algorithm and MUST NOT be substituted for Keccak-256 in conformant implementations.

### Block Structure

A Block contains four fields:

- `content` — JSON-serializable payload. The protocol treats payload meaning as opaque.
- `contentHash` — Keccak-256 digest of canonicalized `content`.
- `parentHashes` — sorted, deduplicated list of parent `blockHash` values. An empty array denotes a root Block.
- `blockHash` — Keccak-256 digest of canonicalized `{ content, parentHashes }`.

The `blockHash` binds content and lineage. The `contentHash` binds content alone.

---

## Prerequisites

- Node.js >= 18
- Steps below run on Node.js alone. No wallet, external service, or database.

## Package Installation

```bash
npm install @alx-protocol/sdk
```

---

## Root Block Creation

A root Block has an empty `parentHashes` array. One requirement is one root Block per source artifact.

```ts
import { createBlock } from "@alx-protocol/sdk";

const sourceA = createBlock({
  type: "document",
  title: "Q4 Market Analysis",
  text: "AI infrastructure spending grew 47% year-over-year...",
});

const sourceB = createBlock({
  type: "document",
  title: "Customer Interviews",
  text: "Customers reported latency as the primary concern...",
});

console.log(sourceA.blockHash);
console.log(sourceA.contentHash);
console.log(sourceA.parentHashes);
```

The same `content` and the same `parentHashes` produce the same `blockHash` on every conformant run. A change to `content` changes `contentHash` and `blockHash`.

---

## Parent Block Creation

A parent Block lists one or more parent `blockHash` values in `parentHashes`.

```ts
const synthesis = createBlock(
  {
    type: "synthesis",
    text: "Market growth and latency concerns both point to infrastructure demand.",
  },
  [sourceA.blockHash, sourceB.blockHash]
);

console.log(synthesis.parentHashes);
```

The SDK normalizes `parentHashes`: lowercase hex, deduplication, lexicographic sort. Parent list order before normalization does not change `blockHash` after normalization.

---

## Output Block Creation

The output Block references the synthesis Block and the sourceA Block.

```ts
const output = createBlock(
  {
    type: "recommendation",
    text: "Increase infrastructure allocation by 20% in Q1.",
  },
  [synthesis.blockHash, sourceA.blockHash]
);
```

---

## Block Validation

The verification process checks that `blockHash` matches a recomputation from `content` and `parentHashes`.

```ts
import { validateBlock } from "@alx-protocol/sdk";

const result = validateBlock(output);
console.log(result.ok);

const tampered = { ...output, content: { text: "modified" } };
console.log(validateBlock(tampered).ok);
```

Tampering with `content` without updating `blockHash` yields `ok: false`.

---

## Attribution Trace

The following operation produces an `AttributionTrace` for a root `blockHash` over a supplied graph.

```ts
import { buildGraph, traceAttribution } from "@alx-protocol/sdk";

const blocks = [sourceA, sourceB, synthesis, output];
const graph = buildGraph(blocks);
const trace = traceAttribution(output.blockHash, graph);

console.log(trace.complete);
console.log(trace.leaves);
console.log(trace.maxDepth);

for (const node of trace.nodes) {
  console.log(`${node.hash.slice(0, 18)}  pathCount=${node.pathCount}  depth=${node.minDepth}`);
}
```

One path runs from the output Block to sourceA through the synthesis Block. A second path runs from the output Block to sourceA directly. The trace reports `pathCount=2` for sourceA and `pathCount=1` for sourceB in the example graph.

---

## Block Persistence

Blocks serialize as JSON. The implementer writes JSON to a file or a content-addressed storage system.

```ts
import { writeFileSync, readFileSync } from "node:fs";

writeFileSync("blocks.json", JSON.stringify(blocks, null, 2));

const loaded = JSON.parse(readFileSync("blocks.json", "utf-8"));
for (const block of loaded) {
  const check = validateBlock(block);
  console.log(`${block.blockHash.slice(0, 18)}... ${check.ok ? "valid" : "INVALID"}`);
}
```

`validateBlock` depends on `content` and `parentHashes` only. The verification result is independent of transport path and storage backend.

---

## Artifact Package Verification

From the repository root:

```bash
pnpm install
pnpm run build
node cli/bin/alx.js package verify artifact-packages/security-review-decision --json
```

The command prints a JSON object. Fields include `ok`, `complete`, `blockHash`, `missingParents`, and `externalParents`.

Canonical artifact packages are in [`artifact-packages/START-HERE.md`](../../artifact-packages/START-HERE.md).

---

## Related Integrator Documents

- [`attributed-outputs.md`](./attributed-outputs.md) — attribution workflow and `pathCount`
- [`api-reference.md`](./api-reference.md) — SDK functions, types, and parameters
- [`agent-integration.md`](./agent-integration.md) — agent outputs as Blocks
- [`verification-receipts.md`](../verification-receipts.md) — verification receipts
- [`faq.md`](./faq.md) — common questions

## Related Documents

- [`../../protocol/spec.md`](../../protocol/spec.md) — normative specification
- [`./api-reference.md`](./api-reference.md) — full SDK API reference
- [`../architecture.md`](../architecture.md) — layer architecture

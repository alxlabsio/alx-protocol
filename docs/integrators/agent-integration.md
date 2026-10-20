# Agent Application Integration

**Document type:** Guide

This guide shows how an application can create ALX Blocks around agent inputs and outputs. Agent frameworks, models, prompts, tool calls, and workflow metadata remain application concerns. Canonical behavior is defined in [`../../protocol/spec.md`](../../protocol/spec.md).

## Boundary

An agent should provide content and known parent Block identities to a conforming SDK. It should not invent `contentHash`, `blockHash`, Graph results, or Trace values.

Application fields such as `type`, `agent`, `model`, `prompt`, `output`, and `timestamp` are conventions inside `content`; they are not required Block fields.

## Create Blocks at durable workflow boundaries

```ts
import { createBlock } from "@alx-protocol/sdk";

const source = createBlock(
  { type: "research.source", text: "Reviewed source material" },
  [],
);

const analysis = createBlock(
  { type: "agent.analysis", model: "application-selected", text: "Analysis output" },
  [source.blockHash],
);

const report = createBlock(
  { type: "agent.report", text: "Final report" },
  [analysis.blockHash, source.blockHash],
);
```

`parentHashes` declares direct structural parents. It does not prove that an agent read, understood, or was causally influenced by the referenced content. Applications define when a workflow relationship should be declared.

## Validate individual Blocks

```ts
import { validateBlock } from "@alx-protocol/sdk";

for (const block of [source, analysis, report]) {
  const result = validateBlock(block);
  if (!result.ok) throw new Error(`Invalid Block: ${block.blockHash}`);
}
```

Block validation proves only the applicable structural and identity properties. It does not establish content truth, model identity, authorship, safety, or authorization.

## Verify the available Graph

```ts
import { validateGraph } from "@alx-protocol/sdk";

const blocks = [source, analysis, report];
const result = validateGraph(
  report,
  { kind: "finite", blocks },
  {
    protocolVersion: "1",
    validationMode: "closed-world",
    graphRoot: report.blockHash,
  },
);

if (result.status !== "valid") {
  console.error(result.status, result.issues, result.missingParents);
}
```

Use `incomplete` to distinguish unavailable required Blocks from definite violations. Use resource limits for untrusted or large sources; a resource-limited result is not a complete validation claim.

Open-world mode is appropriate only when external parents are explicitly declared in the verification context. It is not permission to ignore arbitrary missing parents.

## Construct a Trace

```ts
import { buildGraph, traceAttribution } from "@alx-protocol/sdk";

const graph = buildGraph(blocks);
const trace = traceAttribution(report.blockHash, graph);
```

Trace nodes, edges, depths, and `pathCount` describe structure. They are not contribution, authorship, ownership, quality, or settlement weights.

## Framework integration pattern

For LangChain, CrewAI, AutoGen, an MCP host, or a custom runtime, integrate at the application lifecycle boundary:

1. select the exact input/output content the application intends to preserve;
2. resolve the direct parent Blocks already known to the application;
3. call `createBlock` after the durable step completes;
4. validate before persistence or exchange;
5. store the complete Block and application metadata separately;
6. re-run Graph verification when missing parents arrive or the verification context changes.

Framework callback APIs and package versions change independently of ALX. Keep framework-specific adapter code with the application rather than copying version-sensitive snippets into protocol documentation.

## Derived child and Explorer views

A Block stores parents only. Children and descendants are derived by scanning or indexing Blocks that declare a hash in `parentHashes`. An application index should report its source scope, revision, pagination, and truncation state.

An indexed neighborhood is not an Attribution Trace and must not reuse Trace `complete` to describe index coverage.

## Data and security

- Apply privacy, consent, DLP, malware, and policy checks before Block creation or persistence.
- Keep prompts, credentials, provider tokens, private tool results, and user data out of public Blocks unless explicitly authorized.
- Treat model and agent identifiers in `content` as application claims.
- Apply authorization and replay policy outside core Block verification.
- Do not execute retrieved content merely because its Block validates.

## Related documents

- [`provider-client-adapters.md`](./provider-client-adapters.md) — optional maintained middleware surface
- [`ai-conventions.md`](./ai-conventions.md) — application-level content conventions
- [`attributed-outputs.md`](./attributed-outputs.md) — output and receipt workflow
- [`storage.md`](./storage.md) — persistence and retrieval boundaries
- [`api-reference.md`](./api-reference.md) — TypeScript SDK surface

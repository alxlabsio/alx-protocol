# ALX For Agent Developers

Agent integration patterns for ALX Blocks. Protocol behavior remains defined by [`../../protocol/spec.md`](../../protocol/spec.md).

---

## Block Requirements For Agents

AI agent outputs are ephemeral, unverifiable, and unattributable. A prompt goes in, a response comes out, and nothing connects the two in a way that can be independently verified. When multiple agents collaborate, the problem compounds: there is no record of which agent produced what, which outputs depend on which inputs, or whether any output underwent tampering.

Blocks solve the attribution gap by binding every agent output into a deterministic identity with declared lineage:

- **Verifiable** — any party can recompute the hash and confirm the output is unchanged.
- **Attributable** — the Graph structure records which agent contributed what.
- **Composable** — agents build on each other's Blocks without shared infrastructure, API keys, or trust assumptions.

A Block is:

```
Block = { blockHash, contentHash, parentHashes, content }
```

The protocol hashes, links, validates, and traces Blocks without inspecting `content`. Application layers interpret `content`.

---

## Agent To Block: Producing Artifacts

An agent wraps output in a Block by calling `createBlock(content, parentHashes)`. The content is an arbitrary JSON-serializable value. The `parentHashes` array links the output to upstream inputs.

```javascript
import { createBlock } from "@alx-protocol/sdk";

// Agent produces a research finding
const finding = createBlock({
  type: "ai.response",
  model: "gpt-4",
  agent: "research-agent-v2",
  prompt: "Analyze Q4 market trends",
  response: "AI infrastructure spending grew 47% YoY...",
  timestamp: Date.now(),
}, []);

// finding.blockHash is the permanent, verifiable identity of the output
console.log(finding.blockHash);    // "0x..." (deterministic keccak-256)
console.log(finding.contentHash);  // "0x..." (hash of content alone)
console.log(finding.parentHashes); // [] (no dependencies)
```

The returned Block is a plain object. Store the Block in a database, object store, content-addressed storage system, or local file. The hash guarantees that any party can verify the Block later, independent of storage location or transport path.

---

## Multi-Agent Chains

When agents build on each other's work, pass upstream `blockHash` values as `parentHashes`. The pattern creates a directed acyclic graph (Graph) that records which agent contributed what and which outputs depend on which inputs.

```javascript
import { createBlock } from "@alx-protocol/sdk";

// Agent 1: Research
const research = createBlock({
  type: "ai.response",
  agent: "research-agent-v2",
  model: "gpt-4",
  prompt: "Analyze Q4 market trends",
  response: "AI infrastructure spending grew 47% YoY...",
  timestamp: Date.now(),
}, []);

// Agent 2: Analysis (builds on research)
const analysis = createBlock({
  type: "ai.analysis",
  agent: "analyst-agent-v1",
  model: "claude-sonnet-4-20250514",
  input: "Summarize implications of the research",
  output: "The 47% growth rate suggests...",
  timestamp: Date.now(),
}, [research.blockHash]);

// Agent 3: Decision (builds on both research and analysis)
const decision = createBlock({
  type: "ai.decision",
  agent: "planner-agent-v1",
  model: "gpt-4",
  input: "Recommend allocation based on research and analysis",
  output: "Increase AI infrastructure allocation by 20%...",
  timestamp: Date.now(),
}, [research.blockHash, analysis.blockHash]);
```

The resulting Graph:

```
research (depth 0, no parents)
    |
    +---> analysis (depth 1, parent: research)
    |         |
    +---------+---> decision (depth 2, parents: research, analysis)
```

The SDK normalizes, sorts, and deduplicates `parentHashes` automatically. Pass order does not affect the resulting `blockHash` — the protocol enforces canonical ordering.

---

## Consuming Blocks

An agent that receives a Block can verify integrity and trace lineage without trusting the sender.

### Validate A Single Block

```javascript
import { validateBlock } from "@alx-protocol/sdk";

// Recompute the hash from content + parents and compare
const result = validateBlock(block);

if (!result.ok) {
  // result.expected = what the hash should be
  // result.actual   = what the block claims
  throw new Error(`Block integrity compromised: expected ${result.expected}, got ${result.actual}`);
}
```

`validateBlock` recomputes `keccak256(canonicalize({ content, parentHashes }))` and compares the result to the Block's `blockHash`. Content, parent, or hash changes cause validation failure.

### Validate A Graph Of Blocks

```javascript
import { buildGraph, validateGraph } from "@alx-protocol/sdk";

// Build a graph from an array of blocks
const blocks = [research, analysis, decision];
const graph = buildGraph(blocks);

// Check structural integrity: no cycles, no self-references,
// no missing parents, no duplicates
const graphResult = validateGraph(graph);

if (!graphResult.ok) {
  console.error("Graph issues:", graphResult.issues);
}

console.log(`Blocks: ${graphResult.blocks}`);
console.log(`Edges: ${graphResult.edges}`);
console.log(`Roots: ${graphResult.roots}`);
```

### Trace Attribution

```javascript
import { traceAttribution, buildGraph } from "@alx-protocol/sdk";

const blocks = [research, analysis, decision];
const graph = buildGraph(blocks);

// Trace the full lineage from the decision block
const trace = traceAttribution(decision.blockHash, graph);

// trace.nodes: every contributing block with depth and path counts
for (const node of trace.nodes) {
  console.log(`${node.hash} depth=${node.minDepth} paths=${node.pathCount}`);
}
// Output:
//   decision  depth=0 paths=1
//   research  depth=1 paths=2  (reachable via decision->research AND decision->analysis->research)
//   analysis  depth=1 paths=1

// trace.edges: every dependency link
// trace.leaves: blocks with no parents (the original sources)
// trace.maxDepth: longest chain length
// trace.cycle: whether a cycle was detected
```

`pathCount` reports how many distinct derivation paths reach a given Block from the root. In the example above, `research` has `pathCount=2` because the decision depends on `research` both directly and through analysis. `pathCount` is a structural Graph property rather than a policy decision.

---

## Content Conventions For Agents

The protocol excludes inspection or enforcement of content structure. The following field conventions make agent-produced Blocks interoperable across systems:

| Field | Purpose | Example values |
|---|---|---|
| `type` | Artifact kind | `"ai.prompt"`, `"ai.response"`, `"ai.tool-call"`, `"ai.decision"`, `"ai.embedding"` |
| `agent` | Agent identifier (name + version) | `"research-agent-v2"`, `"code-gen-v1.3"` |
| `model` | Model used, if applicable | `"gpt-4"`, `"claude-sonnet-4-20250514"`, `"llama-3-70b"` |
| `timestamp` | When the output was produced | `1714600000000` (Unix ms) |

The field list serves as a recommendation rather than a requirement. The protocol hashes whatever appears in `content`. Consistent field names let different agent systems interpret Blocks without out-of-band coordination.

Additional type values for common agent operations:

- `"ai.prompt"` — the input to an agent
- `"ai.response"` — the agent's output
- `"ai.tool-call"` — an agent invoking an external tool (API call, database query, code execution)
- `"ai.decision"` — an agent choosing between alternatives
- `"ai.embedding"` — a vector representation of content

---

## Agent Interoperability

Blocks exclude shared infrastructure between agents. The verification algorithm is pure math:

1. Canonicalize `{ content, parentHashes }` using deterministic JSON serialization.
2. Hash the result with keccak-256.
3. Compare.

The pattern implies:

- Agent A (running OpenAI GPT-4) creates a Block.
- Agent B (running Anthropic Claude) receives the Block, calls `validateBlock`, and confirms integrity.
- Agent B creates a new Block with Agent A's `blockHash` as a parent.
- Agent C (a local script with no API keys) can verify the entire chain.

Verification requires no shared database, coordination service, or trust assumptions. Any conformant implementation in any language produces identical hashes for identical inputs.

---

## Example: Multi-Vendor Agent Pipeline

A complete pipeline with three different agent systems producing a verified chain:

```javascript
import {
  createBlock,
  validateBlock,
  buildGraph,
  validateGraph,
  traceAttribution,
} from "@alx-protocol/sdk";

// ── Step 1: Research agent (OpenAI GPT-4) ──────────────────────────

const researchBlock = createBlock({
  type: "ai.response",
  agent: "research-agent-v2",
  model: "gpt-4",
  prompt: "Summarize recent advances in battery technology",
  response: "Solid-state batteries have achieved 400 Wh/kg energy density...",
  timestamp: 1714600000000,
}, []);

// ── Step 2: Code generator (Anthropic Claude) ──────────────────────

// Verify the research block before building on it
const researchValid = validateBlock(researchBlock);
if (!researchValid.ok) throw new Error("Research block is invalid");

const codeBlock = createBlock({
  type: "ai.response",
  agent: "codegen-agent-v1",
  model: "claude-sonnet-4-20250514",
  prompt: "Write a simulation for solid-state battery degradation",
  response: "function simulateDegradation(cycles, tempC) { ... }",
  timestamp: 1714600060000,
}, [researchBlock.blockHash]);

// ── Step 3: Test runner (local agent, no LLM) ─────────────────────

const codeValid = validateBlock(codeBlock);
if (!codeValid.ok) throw new Error("Code block is invalid");

const testBlock = createBlock({
  type: "ai.tool-call",
  agent: "test-runner-v3",
  tool: "vitest",
  input: "Run degradation simulation test suite",
  output: { passed: 14, failed: 0, duration: "2.3s" },
  timestamp: 1714600120000,
}, [codeBlock.blockHash]);

// ── Validate the full graph ────────────────────────────────────────

const allBlocks = [researchBlock, codeBlock, testBlock];
const graph = buildGraph(allBlocks);

const graphResult = validateGraph(graph);
console.log("Graph valid:", graphResult.ok);
console.log("Total blocks:", graphResult.blocks);   // 3
console.log("Total edges:", graphResult.edges);      // 2
console.log("Root blocks:", graphResult.roots);      // [researchBlock.blockHash]

// ── Trace attribution from the final output ────────────────────────

const trace = traceAttribution(testBlock.blockHash, graph);

console.log("\nAttribution trace from test results:");
for (const node of trace.nodes) {
  // Find the original block to get the agent name
  const original = allBlocks.find(b => b.blockHash === node.hash);
  const agent = original?.content?.agent ?? "unknown";
  console.log(
    `  ${agent}: depth=${node.minDepth}, paths=${node.pathCount}`
  );
}
// Output:
//   test-runner-v3:    depth=0, paths=1
//   codegen-agent-v1:  depth=1, paths=1
//   research-agent-v2: depth=2, paths=1

console.log(`\nLeaf blocks (original sources): ${trace.leaves}`);
console.log(`Max chain depth: ${trace.maxDepth}`);
console.log(`Cycle detected: ${trace.cycle}`);
```

The trace shows that the test results (depth 0) depend on generated code (depth 1), which depends on research (depth 2). Each Block in the chain came from a different agent running a different model. The entire pipeline is verifiable by anyone with the Blocks — no access to the original agents or APIs required.

---

## Key Points

- `createBlock(content, parentHashes)` wraps any agent output in a verifiable container.
- `validateBlock(block)` confirms a Block is unchanged. Pure hash comparison, no network calls.
- `buildGraph(blocks)` and `traceAttribution(rootHash, graph)` resolve the full lineage structure.
- `parentHashes` are the only mechanism for expressing dependencies. The protocol handles normalization and ordering.
- Content is opaque. Use consistent field names (`type`, `agent`, `model`, `timestamp`) for interoperability. The protocol excludes enforcement of field names.
- Same content + same parents = same `blockHash`, always. The identity is deterministic across all implementations and languages.

---

## Current Tooling Surface

For current package-level workflows, use the CLI package verifier and canonical artifact packages:

```bash
alx package verify artifact-packages/context-aware-agent-response --json
alx package verify artifact-packages/policy-constrained-agent-response --json
alx package verify artifact-packages/adaptive-interface-state --json
```

Agent systems should provide content and parent Block references to a conformant SDK or service. The SDK computes hashes, validates Blocks, and emits traces or receipts.

Avoid asking the model to invent `contentHash` or `blockHash` values.

## Related Documents

- [`adapters.md`](./adapters.md) — current integration surfaces
- [`agent-frameworks.md`](./agent-frameworks.md) — LangChain, CrewAI, AutoGen
- [`workflows.md`](./workflows.md) — research, compliance, marketplace scenarios
- [`../../artifact-packages/START-HERE.md`](../../artifact-packages/START-HERE.md) — canonical package examples
- [`api-reference.md`](./api-reference.md) — TypeScript SDK reference

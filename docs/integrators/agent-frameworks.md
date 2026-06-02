# Agent Framework Integration Guide

Patterns for wrapping agent outputs as Blocks. Protocol behavior remains defined by [`../../protocol/spec.md`](../../protocol/spec.md).

---

## Purpose

Product systems wrap agent outputs as Blocks when using external agent frameworks. Framework integrations are optional and external to core Block validity.

## Scope

- Framework-agnostic universal pattern for Block creation
- LangChain callback handlers and chain integration
- CrewAI task output wrapping and multi-agent crews
- AutoGen message hooks for conversational agents
- Custom agent wrappers and batch processing
- End-to-end pipeline verification

## Non-Goals

- Framework installation and configuration (see each framework's own documentation)
- Protocol specification details (see [`protocol/spec.md`](../../protocol/spec.md))
- Storage and persistence patterns (see [Storage Guide](./storage.md))
- Settlement and economic coordination (see [Settlement](./settlement.md))

---

## Universal Pattern

Every agent framework follows the same integration pattern: root blocks for source inputs, parent blocks for intermediate steps, output block referencing upstream steps, and an attribution trace to verify provenance.

```ts
import { createBlock, buildGraph, traceAttribution } from "@alx-protocol/sdk";

// Root block — the source input the agent received
const sourceBlock = createBlock({
  type: "ai.context",
  agent: "retrieval-agent-v1",
  output: retrievedDocument,
  timestamp: Date.now(),
}, []);  // no parents — root block

// Parent block — intermediate processing
const processedBlock = createBlock({
  type: "ai.response",
  agent: "summarization-agent-v1",
  model: "claude-sonnet-4-20250514",
  output: agentOutput,
  timestamp: Date.now(),
}, [sourceBlock.blockHash]);

// Output block — final result, may reference the source directly as well
const outputBlock = createBlock({
  type: "ai.response",
  agent: "review-agent-v1",
  model: "gpt-4o",
  output: await runReviewAgent(agentOutput),
  timestamp: Date.now(),
}, [processedBlock.blockHash, sourceBlock.blockHash]);
// sourceBlock is referenced directly AND through processedBlock → pathCount=2

// Attribution trace — verify what shaped the output
const graph = buildGraph([sourceBlock, processedBlock, outputBlock]);
const trace = traceAttribution(outputBlock.blockHash, graph);
console.log("Complete:", trace.complete);
for (const node of trace.nodes) {
  console.log(`  ${node.hash.slice(0, 18)}  pathCount=${node.pathCount}`);
}
// sourceBlock: pathCount=2 (two paths reach it from the output)
// processedBlock: pathCount=1
// outputBlock: pathCount=1 (root of trace)
```

The pattern applies to every framework below. The only difference is where the integration hooks into each framework's lifecycle to capture inputs, intermediate steps, and final outputs.

---

## LangChain Integration

### Custom Callback Handler

LangChain provides callback hooks that fire at each stage of a chain's execution. Use a custom callback handler to create a Block whenever a chain completes.

```ts
// langchain ^0.3.x
import { BaseCallbackHandler } from "@langchain/core/callbacks/base";
import { createBlock } from "@alx-protocol/sdk";
import type { ChainValues } from "@langchain/core/utils/types";

interface BlockRecord {
  blockHash: string;
  block: ReturnType<typeof createBlock>;
}

class ALXCallbackHandler extends BaseCallbackHandler {
  name = "ALXCallbackHandler";
  private blocks: BlockRecord[] = [];
  private parentHashes: string[];

  constructor(parentHashes: string[] = []) {
    super();
    this.parentHashes = parentHashes;
  }

  async handleChainEnd(outputs: ChainValues, runId: string): Promise<void> {
    const block = createBlock({
      type: "ai.response",
      agent: "langchain-chain",
      runId,
      output: outputs,
      timestamp: Date.now(),
    }, this.parentHashes);

    this.blocks.push({ blockHash: block.blockHash, block });

    // Each subsequent chain step becomes a child of this one
    this.parentHashes = [block.blockHash];
  }

  getBlocks(): BlockRecord[] {
    return this.blocks;
  }

  getLatestBlockHash(): string | undefined {
    return this.blocks.at(-1)?.blockHash;
  }
}
```

### Research Chain With Lineage

A three-step research pipeline where each step produces a Block linked to the previous one.

```ts
// langchain ^0.3.x, @langchain/openai ^0.3.x
import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { createBlock, buildGraph, validateGraph } from "@alx-protocol/sdk";

const llm = new ChatOpenAI({ model: "gpt-4o", temperature: 0 });
const outputParser = new StringOutputParser();

// Step 1: Gather raw research
const gatherPrompt = PromptTemplate.fromTemplate(
  "List the top 5 recent developments in {topic}. Be specific with dates and sources."
);
const gatherChain = RunnableSequence.from([gatherPrompt, llm, outputParser]);
const rawResearch = await gatherChain.invoke({ topic: "solid-state battery manufacturing" });

const gatherBlock = createBlock({
  type: "ai.response",
  agent: "research-gather-v1",
  model: "gpt-4o",
  task: "Gather raw research on solid-state battery manufacturing",
  output: rawResearch,
  timestamp: Date.now(),
}, []);

// Step 2: Synthesize findings
const synthesizePrompt = PromptTemplate.fromTemplate(
  "Given these research findings, identify the three most impactful trends:\n\n{findings}"
);
const synthesizeChain = RunnableSequence.from([synthesizePrompt, llm, outputParser]);
const synthesis = await synthesizeChain.invoke({ findings: rawResearch });

const synthesisBlock = createBlock({
  type: "ai.analysis",
  agent: "research-synthesize-v1",
  model: "gpt-4o",
  task: "Synthesize research into key trends",
  output: synthesis,
  timestamp: Date.now(),
}, [gatherBlock.blockHash]);

// Step 3: Generate executive summary
const summaryPrompt = PromptTemplate.fromTemplate(
  "Write a 200-word executive summary based on these trends:\n\n{trends}"
);
const summaryChain = RunnableSequence.from([summaryPrompt, llm, outputParser]);
const summary = await summaryChain.invoke({ trends: synthesis });

const summaryBlock = createBlock({
  type: "ai.response",
  agent: "research-summarize-v1",
  model: "gpt-4o",
  task: "Generate executive summary",
  output: summary,
  timestamp: Date.now(),
}, [synthesisBlock.blockHash]);

// Validate the full lineage chain
const allBlocks = [gatherBlock, synthesisBlock, summaryBlock];
const graph = buildGraph(allBlocks);
const result = validateGraph(graph);
console.log("Pipeline valid:", result.ok);
console.log("Chain depth:", result.roots.length, "root(s),", result.blocks, "total Blocks");

// Trace attribution from the final summary back to its sources
const trace = traceAttribution(summaryBlock.blockHash, graph);
console.log("Complete:", trace.complete);  // true
for (const node of trace.nodes) {
  const original = allBlocks.find(b => b.blockHash === node.hash);
  console.log(`  ${original?.content?.agent}: depth=${node.minDepth}, pathCount=${node.pathCount}`);
}
// Output (linear chain — each node has pathCount=1):
//   research-summarize-v1: depth=0, pathCount=1
//   research-synthesize-v1: depth=1, pathCount=1
//   research-gather-v1: depth=2, pathCount=1
```

The resulting Graph forms a linear chain. Each node has `pathCount=1` because there is exactly one path from the summary block to each upstream block. To increase `pathCount` for a source, an output block must reference the source through more than one derivation path.

```
gatherBlock (depth 2, pathCount=1)
  └─> synthesisBlock (depth 1, pathCount=1)
        └─> summaryBlock (depth 0, root of trace)
```

---

## CrewAI Integration

### Task Output To Block

CrewAI organizes agents into crews that execute tasks. Wrap each task's output as a Block after the crew completes.

```ts
// crewai-js ^0.1.x (TypeScript bindings)
import { createBlock } from "@alx-protocol/sdk";

interface CrewTaskResult {
  taskName: string;
  agentRole: string;
  output: string;
}

function taskResultToBlock(
  result: CrewTaskResult,
  model: string,
  parentHashes: string[] = [],
): ReturnType<typeof createBlock> {
  return createBlock({
    type: "ai.response",
    agent: `crewai-${result.agentRole}`,
    model,
    task: result.taskName,
    output: result.output,
    timestamp: Date.now(),
  }, parentHashes);
}
```

### Multi-Agent Crew With Lineage Tracking

A content production crew with a researcher, writer, and editor. Each agent's output becomes a Block linked to its dependencies.

```ts
import { createBlock, buildGraph, validateGraph, traceAttribution } from "@alx-protocol/sdk";

// Simulate a CrewAI crew execution with three sequential tasks.
// In production, these results come from CrewAI's task execution callbacks.

// Task 1: Market researcher gathers competitive intelligence
const researchResult = {
  taskName: "Gather competitive intelligence on enterprise AI platforms",
  agentRole: "market-researcher",
  output: "Analysis of 12 enterprise AI platforms shows convergence toward...",
};

const researchBlock = createBlock({
  type: "ai.response",
  agent: "crewai-market-researcher",
  model: "gpt-4o",
  task: researchResult.taskName,
  output: researchResult.output,
  timestamp: Date.now(),
}, []);

// Task 2: Technical writer drafts a report based on research
const writerResult = {
  taskName: "Draft competitive landscape report",
  agentRole: "technical-writer",
  output: "Enterprise AI Platform Competitive Landscape Q1 2026\n\n1. Market Overview...",
};

const writerBlock = createBlock({
  type: "ai.response",
  agent: "crewai-technical-writer",
  model: "claude-sonnet-4-20250514",
  task: writerResult.taskName,
  output: writerResult.output,
  timestamp: Date.now(),
}, [researchBlock.blockHash]);

// Task 3: Editor reviews and finalizes
const editorResult = {
  taskName: "Review report for accuracy and clarity",
  agentRole: "editor",
  output: "Final Report: Enterprise AI Platform Competitive Landscape Q1 2026 (reviewed)...",
};

const editorBlock = createBlock({
  type: "ai.response",
  agent: "crewai-editor",
  model: "gpt-4o",
  task: editorResult.taskName,
  output: editorResult.output,
  timestamp: Date.now(),
}, [researchBlock.blockHash, writerBlock.blockHash]);

// Validate the crew's output Graph
const crewBlocks = [researchBlock, writerBlock, editorBlock];
const graph = buildGraph(crewBlocks);
const validation = validateGraph(graph);
console.log("Crew pipeline valid:", validation.ok);

// Trace attribution from the final deliverable
const trace = traceAttribution(editorBlock.blockHash, graph);
for (const node of trace.nodes) {
  const original = crewBlocks.find(b => b.blockHash === node.hash);
  console.log(
    `  ${original?.content?.agent}: depth=${node.minDepth}, pathCount=${node.pathCount}`
  );
}
// Output:
//   crewai-editor:            depth=0, pathCount=1
//   crewai-technical-writer:  depth=1, pathCount=1
//   crewai-market-researcher: depth=1, pathCount=2
```

The editor Block has two parents (research and writer), so the market researcher has `pathCount=2` -- reachable via both `editor->researchBlock` and `editor->writerBlock->researchBlock`.

---

## AutoGen Integration

### Message Hooks For Multi-Agent Conversations

AutoGen uses conversational agents that exchange messages. Hook into the message flow to create a Block for each agent response.

```ts
// autogen ^0.4.x (TypeScript/JavaScript client)
import { createBlock } from "@alx-protocol/sdk";

interface AutoGenMessage {
  role: string;
  content: string;
  name: string;  // agent name
}

class ALXMessageTracker {
  private blocks: ReturnType<typeof createBlock>[] = [];
  private latestBlockHash: string | undefined;

  onMessageReceived(message: AutoGenMessage, model: string): void {
    const block = createBlock({
      type: "ai.response",
      agent: `autogen-${message.name}`,
      model,
      role: message.role,
      content: message.content,
      timestamp: Date.now(),
    }, this.latestBlockHash ? [this.latestBlockHash] : []);

    this.blocks.push(block);
    this.latestBlockHash = block.blockHash;
  }

  getBlocks(): ReturnType<typeof createBlock>[] {
    return this.blocks;
  }

  getLatestBlockHash(): string | undefined {
    return this.latestBlockHash;
  }
}
```

### Multi-Agent Conversation Example

A planning conversation between an engineer and a product manager, with each turn recorded as a Block.

```ts
import { createBlock, buildGraph, validateGraph, traceAttribution } from "@alx-protocol/sdk";

const tracker = new ALXMessageTracker();

// Simulate a two-agent AutoGen conversation about API design

// Turn 1: Product manager defines requirements
tracker.onMessageReceived({
  role: "assistant",
  content: "We need a REST API for the inventory service. Requirements: " +
    "1) List items with pagination, 2) Create/update items, 3) Bulk import via CSV.",
  name: "product-manager",
}, "gpt-4o");

// Turn 2: Engineer proposes design
tracker.onMessageReceived({
  role: "assistant",
  content: "Proposed endpoints: GET /items?page=&limit=, POST /items, " +
    "PUT /items/:sku, POST /items/import. Bulk import uses multipart/form-data " +
    "with streaming validation.",
  name: "engineer",
}, "claude-sonnet-4-20250514");

// Turn 3: Product manager refines
tracker.onMessageReceived({
  role: "assistant",
  content: "Add GET /items/:sku for single-item lookup. The bulk import " +
    "should return a job ID for async tracking. Add GET /import-jobs/:jobId.",
  name: "product-manager",
}, "gpt-4o");

// Turn 4: Engineer finalizes
tracker.onMessageReceived({
  role: "assistant",
  content: "Final API spec: 6 endpoints total. Added webhook support for " +
    "import job completion. OpenAPI 3.1 spec attached.",
  name: "engineer",
}, "claude-sonnet-4-20250514");

// Validate the conversation Graph
const conversationBlocks = tracker.getBlocks();
const graph = buildGraph(conversationBlocks);
const result = validateGraph(graph);
console.log("Conversation valid:", result.ok);
console.log("Turns recorded:", result.blocks);  // 4

// Trace from the final message back to the origin
const trace = traceAttribution(tracker.getLatestBlockHash()!, graph);
console.log("Conversation depth:", trace.maxDepth);   // 3
console.log("Original source:", trace.leaves.length);  // 1 root message
```

Each conversational turn is a Block whose parent is the previous turn, forming a linear chain:

```
product-manager (turn 1, root)
  └─> engineer (turn 2)
        └─> product-manager (turn 3)
              └─> engineer (turn 4)
```

---

## Custom Agents

### Minimal Wrapper

Agents without a framework require only a thin wrapper.

```ts
import { createBlock, validateBlock } from "@alx-protocol/sdk";

async function runAgentWithBlock(
  agentName: string,
  model: string,
  task: string,
  execute: (task: string) => Promise<string>,
  parentHashes: string[] = [],
): Promise<ReturnType<typeof createBlock>> {
  const output = await execute(task);

  const block = createBlock({
    type: "ai.response",
    agent: agentName,
    model,
    task,
    output,
    timestamp: Date.now(),
  }, parentHashes);

  // Verify immediately after creation
  const check = validateBlock(block);
  if (!check.ok) {
    throw new Error(`Block creation failed: expected ${check.expected}, got ${check.actual}`);
  }

  return block;
}

// Usage
const translateBlock = await runAgentWithBlock(
  "translation-agent-v2",
  "gpt-4o",
  "Translate the project charter from English to Japanese",
  async (task) => {
    // Call your LLM API here
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "user", content: task }],
      }),
    });
    const data = await response.json();
    return data.choices[0].message.content;
  },
);
```

### Batch Processing Pattern

Process multiple inputs through an agent, producing a Block for each, then merge results into a single summary Block.

```ts
import { createBlock, buildGraph, validateGraph } from "@alx-protocol/sdk";

interface DocumentInput {
  title: string;
  content: string;
}

async function batchClassify(
  documents: DocumentInput[],
  classify: (doc: DocumentInput) => Promise<string>,
): Promise<ReturnType<typeof createBlock>[]> {
  // Process each document independently, creating parallel root Blocks
  const classificationBlocks = await Promise.all(
    documents.map(async (doc) => {
      const label = await classify(doc);
      return createBlock({
        type: "ai.response",
        agent: "document-classifier-v3",
        model: "claude-haiku-3.5",
        task: `Classify: ${doc.title}`,
        input: { title: doc.title, contentLength: doc.content.length },
        output: { label, confidence: 0.94 },
        timestamp: Date.now(),
      }, []);
    })
  );

  // Merge all classifications into a summary Block
  const summaryBlock = createBlock({
    type: "ai.analysis",
    agent: "batch-aggregator-v1",
    model: "claude-haiku-3.5",
    task: "Aggregate document classifications",
    output: {
      totalDocuments: documents.length,
      classifications: classificationBlocks.map(b => ({
        blockHash: b.blockHash,
        label: (b.content as Record<string, unknown>).output,
      })),
    },
    timestamp: Date.now(),
  }, classificationBlocks.map(b => b.blockHash));

  // Validate the batch Graph
  const allBlocks = [...classificationBlocks, summaryBlock];
  const graph = buildGraph(allBlocks);
  const result = validateGraph(graph);
  if (!result.ok) {
    console.error("Batch Graph validation failed:", result.issues);
  }

  return allBlocks;
}

// Usage
const documents: DocumentInput[] = [
  { title: "Q1 Revenue Report", content: "Revenue increased 12% quarter-over-quarter..." },
  { title: "Security Incident Post-Mortem", content: "On March 14, unauthorized access was detected..." },
  { title: "Employee Onboarding Checklist", content: "Welcome to the team. Complete these steps..." },
];

const blocks = await batchClassify(documents, async (doc) => {
  // Call your classification model here
  return doc.title.includes("Revenue") ? "financial"
    : doc.title.includes("Security") ? "security"
    : "operations";
});

console.log(`Created ${blocks.length} Blocks (${blocks.length - 1} classifications + 1 summary)`);
```

The resulting Graph has a fan-in structure:

```
classification-1  classification-2  classification-3
       \                |                /
        \               |               /
         └──────> summaryBlock <───────┘
```

---

## Verifying Agent Pipelines

After an agent pipeline completes, verify the entire output Graph to confirm structural integrity and trace attribution.

```ts
import {
  createBlock,
  validateBlock,
  buildGraph,
  validateGraph,
  traceAttribution,
} from "@alx-protocol/sdk";

// Assume a pipeline has produced these Blocks
const ingestionBlock = createBlock({
  type: "ai.response",
  agent: "data-ingestion-v2",
  model: "gpt-4o-mini",
  task: "Extract structured data from 500 support tickets",
  output: { ticketsProcessed: 500, categoriesFound: 12 },
  timestamp: Date.now(),
}, []);

const analysisBlock = createBlock({
  type: "ai.analysis",
  agent: "trend-analyzer-v1",
  model: "claude-sonnet-4-20250514",
  task: "Identify top 5 recurring support issues",
  output: {
    trends: [
      { issue: "Authentication timeout", frequency: 89 },
      { issue: "CSV export truncation", frequency: 67 },
      { issue: "Webhook delivery delays", frequency: 54 },
      { issue: "Rate limit error messages unclear", frequency: 41 },
      { issue: "SSO configuration wizard fails on step 3", frequency: 38 },
    ],
  },
  timestamp: Date.now(),
}, [ingestionBlock.blockHash]);

const recommendationBlock = createBlock({
  type: "ai.decision",
  agent: "prioritization-agent-v1",
  model: "gpt-4o",
  task: "Recommend engineering priorities based on support trends",
  output: {
    priority1: "Fix authentication timeout (89 tickets, est. 3 story points)",
    priority2: "Fix CSV export truncation (67 tickets, est. 5 story points)",
    priority3: "Investigate webhook delays (54 tickets, requires infrastructure review)",
  },
  timestamp: Date.now(),
}, [ingestionBlock.blockHash, analysisBlock.blockHash]);

// ── Step 1: Validate each Block individually ──────────────────────────

const allBlocks = [ingestionBlock, analysisBlock, recommendationBlock];

for (const block of allBlocks) {
  const result = validateBlock(block);
  if (!result.ok) {
    throw new Error(
      `Block ${block.blockHash.slice(0, 18)}... integrity check failed: ` +
      `expected ${result.expected}, got ${result.actual}`
    );
  }
}
console.log("All individual Blocks verified.");

// ── Step 2: Build and validate the Graph ──────────────────────────────

const graph = buildGraph(allBlocks);
const graphResult = validateGraph(graph);

if (!graphResult.ok) {
  console.error("Graph validation issues:", graphResult.issues);
  throw new Error("Pipeline Graph is structurally invalid");
}

console.log(`Graph valid: ${graphResult.ok}`);
console.log(`  Blocks: ${graphResult.blocks}`);    // 3
console.log(`  Edges: ${graphResult.edges}`);       // 3
console.log(`  Roots: ${graphResult.roots.length}`); // 1 (ingestionBlock)

// ── Step 3: Trace attribution from the final output ───────────────────

const trace = traceAttribution(recommendationBlock.blockHash, graph);

console.log(`\nAttribution trace from recommendation:`);
console.log(`  Total contributing Blocks: ${trace.nodes.length}`);
console.log(`  Max chain depth: ${trace.maxDepth}`);
console.log(`  Cycle detected: ${trace.cycle}`);      // false
console.log(`  Leaf Blocks (original sources): ${trace.leaves.length}`);

for (const node of trace.nodes) {
  const original = allBlocks.find(b => b.blockHash === node.hash);
  const agent = (original?.content as Record<string, unknown>)?.agent ?? "unknown";
  console.log(
    `  ${agent}: depth=${node.minDepth}, pathCount=${node.pathCount}`
  );
}
// Output:
//   prioritization-agent-v1: depth=0, pathCount=1
//   trend-analyzer-v1:       depth=1, pathCount=1
//   data-ingestion-v2:       depth=1, pathCount=2

// ingestionBlock has pathCount=2 because it is reachable via:
//   recommendation -> ingestionBlock (direct parent)
//   recommendation -> analysisBlock -> ingestionBlock (indirect)

// ── Step 4: Verify leaves are the expected original sources ───────────

const expectedRoot = ingestionBlock.blockHash;
if (!trace.leaves.includes(expectedRoot)) {
  throw new Error("Expected ingestion Block to be a leaf in the trace");
}
console.log("\nPipeline verification complete. All Blocks valid, Graph intact, attribution traced.");
```

---

## Related Documents

- [Real-World Workflows](./workflows.md) -- three production scenarios: research pipeline, compliance audit, multi-vendor marketplace
- [Quickstart](./quickstart.md) -- five-minute introduction to the SDK
- [API Reference](./api-reference.md) -- complete SDK function and type reference
- [Agent Integration](./agent-integration.md) -- core patterns for wrapping agent outputs as Blocks
- [Settlement](./settlement.md) -- using `pathCount` for economic coordination across agents

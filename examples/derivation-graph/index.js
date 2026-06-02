/**
 * ALX Protocol — derivation graph example
 *
 * Builds a 4-block chain: system prompt → prompt → response → decision.
 * Each block declares its upstream parent. Runs traceAttribution to compute
 * structural path counts across the graph.
 *
 * Run: node examples/derivation-graph/index.js
 */

import { createBlock, validateBlock, traceAttribution } from "../../sdk/dist/index.js";

// Block 1: governed system prompt — root, no parents.
const systemPrompt = createBlock({
  type: "ai.system-prompt",
  text: "You are a senior market analyst. Produce institutional-grade acquisition analysis.",
  version: "1.0.0",
  owner: "investment-committee",
});

// Block 2: user prompt — parent: system prompt.
const prompt = createBlock(
  {
    type: "ai.prompt",
    text: "Analyze whether to proceed with the Meridian Holdings acquisition.",
    sessionId: "sess_meridian_01",
  },
  [systemPrompt.blockHash]
);

// Block 3: AI response — parent: prompt.
const response = createBlock(
  {
    type: "ai.response",
    text: "Recommend proceeding. Primary risk: UK regulatory review timeline (90–120 days).",
    model: "your-model-id",
  },
  [prompt.blockHash]
);

// Block 4: human decision — parent: response.
const decision = createBlock(
  {
    type: "decision",
    outcome: "approved",
    summary: "Approved — proceed with acquisition pending UK legal review.",
    decidedBy: "investment-committee",
  },
  [response.blockHash]
);

// All four blocks are independently valid.
[systemPrompt, prompt, response, decision].forEach((b, i) => {
  console.log(`block[${i}] valid:`, validateBlock(b).ok, "  hash:", b.blockHash.slice(0, 12) + "...");
});

// Build the graph: blockHash → parentHashes[]
const graph = new Map([
  [systemPrompt.blockHash, systemPrompt.parentHashes],
  [prompt.blockHash, prompt.parentHashes],
  [response.blockHash, response.parentHashes],
  [decision.blockHash, decision.parentHashes],
]);

// Trace from the decision back to the system prompt.
const trace = traceAttribution(decision.blockHash, graph);

console.log("\ntrace.complete:  ", trace.complete);
console.log("trace.maxDepth:  ", trace.maxDepth);    // 3
console.log("trace.nodes:     ", trace.nodes.length); // 4

// pathCount from the root system prompt to the final decision.
const systemPromptNode = trace.nodes.find(n => n.hash === systemPrompt.blockHash);
console.log("pathCount (system-prompt → decision):", systemPromptNode?.pathCount); // 1

/**
 * ALX Protocol — agent pair example
 *
 * Seals a prompt+response pair. The response Block declares the prompt as a
 * parent — the lineage is bound into blockHash, not inferred from logs.
 *
 * Run: node examples/agent-pair/index.js
 */

import { createBlock, validateBlock } from "../../sdk/dist/index.js";

// Block 1: seal the prompt before sending to the model.
const prompt = createBlock({
  type: "ai.prompt",
  text: "Analyze Q4 trends and summarize risks.",
  model: "your-model-id",
  sessionId: "sess_01abc",
});

console.log("prompt.blockHash:", prompt.blockHash);

// Block 2: seal the response, declaring the prompt as parent.
// response.parentHashes === [prompt.blockHash] — bound into blockHash.
const response = createBlock(
  {
    type: "ai.response",
    text: "AI infrastructure investment up 47% YoY. Key risk: concentration in three vendors.",
    model: "your-model-id",
  },
  [prompt.blockHash]
);

console.log("response.blockHash:   ", response.blockHash);
console.log("response.parentHashes:", response.parentHashes);
// → ["<prompt.blockHash>"] — the exact prompt that produced this response

// Verify both blocks independently.
console.log("prompt valid:  ", validateBlock(prompt).ok);
console.log("response valid:", validateBlock(response).ok);

// Swap the parent — the response hash breaks.
const wrongParent = createBlock(response.content, ["0x" + "a".repeat(64)]);
console.log("wrong parent valid:", validateBlock(wrongParent).ok); // true — new block, different identity
console.log("same hash?:        ", wrongParent.blockHash === response.blockHash); // false

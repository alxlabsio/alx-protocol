/**
 * ALX Protocol — basic example
 *
 * Seals an artifact as a Block and verifies it locally.
 * No network, no vendor, no external service.
 *
 * Run: node examples/basic/index.js
 */

import { createBlock, validateBlock } from "../../sdk/dist/index.js";

// Seal any JSON-serializable artifact as a Block.
// blockHash = keccak256(canonicalize({ content, parentHashes }))
const block = createBlock(
  { type: "ai.response", text: "AI infrastructure investment up 47% YoY", model: "your-model-id" },
  []
);

console.log("blockHash:   ", block.blockHash);
console.log("contentHash: ", block.contentHash);
console.log("parentHashes:", block.parentHashes);

// Verify locally — recomputes blockHash from content and parentHashes.
// No network call. No vendor service.
const result = validateBlock(block);
console.log("valid:       ", result.ok);

// Tamper with content — the hash breaks.
const tampered = { ...block, content: { ...block.content, text: "modified" } };
const tamperResult = validateBlock(tampered);
console.log("tampered ok: ", tamperResult.ok); // false

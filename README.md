<h1 align="center">ALX Protocol</h1><p align="center"><strong>An open protocol for composable context</strong></p><p align="center">
Package, link, and verify context across AI systems, agents, and applications.
</p><p align="center">
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT">
  </a>
</p>

## What is ALX?

ALX Protocol defines Blocks: portable context artifacts with deterministic identity and explicit lineage.

A Block can represent a source document, prompt, model response, dataset, analysis, review, decision, workflow state, tool response, or agent handoff.

Each Block includes:

- "content" — opaque JSON-serializable artifact data
- "parentHashes" — declared upstream Block references
- "contentHash" — identity for the content only
- "blockHash" — identity for the content plus parent lineage

If the content changes, the hash changes.
If the parent references change, the hash changes.
If nothing changes, any conformant implementation produces the same hash.

Verification is local. No blockchain, token, hosted service, storage provider, or vendor API is required.

## Install

npm install @alx-protocol/sdk

Create and Verify a Block

import { lock, validateBlock } from "@alx-protocol/sdk";

const prompt = lock({
  type: "ai.prompt",
  text: "Analyze Q4 trends",
});

const response = lock(
  {
    type: "ai.response",
    text: "AI infrastructure increased in Q4.",
  },
  {
    parents: [prompt],
  }
);

const result = validateBlock(response);

console.log(result.ok); // true

The response Block references the prompt Block as a parent. That parent relationship is part of the response Block’s identity.

## Documentation

- "Whitepaper" (docs/whitepaper.md)
- "Getting Started" (docs/integrators/quickstart.md)
- "Protocol specification" (protocol/spec.md)
- "API Reference" (docs/integrators/api-reference.md)
- "Trust model" (docs/trust-model.md)
- "CLI" (cli/README.md)

## License

MIT © ALX Foundation

<h1 align="center">ALX Protocol</h1><p align="center"><strong>The open protocol for composable context</strong></p><p align="center">
Package, link, and verify context across AI systems, agents, and applications.
</p><p align="center">
  <a href="https://github.com/xandrlabs/alx-protocol/actions/workflows/ci.yml">
    <img src="https://github.com/xandrlabs/alx-protocol/actions/workflows/ci.yml/badge.svg" alt="CI">
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT">
  </a>
  <a href="docs/integrators/on-chain-base.md" title="Optional anchoring on Base; not required for ALX core">
    <img src="https://img.shields.io/badge/Chain-optional-0052FF" alt="Blockchain optional">
  </a>
</p>---

<h2 align="center">What is ALX?</h2>ALX Protocol defines Blocks: portable context artifacts with deterministic identity and explicit lineage.

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

---

<h2 align="center">Install</h2>npm install @alx-protocol/sdk

---

<h2 align="center">Create and Verify a Block</h2>import { lock, validateBlock } from "@alx-protocol/sdk";

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

---

<h2 align="center">Documentation</h2>- "Whitepaper" (docs/whitepaper.md)
- "Getting Started" (docs/integrators/quickstart.md)
- "Protocol specification" (protocol/spec.md)
- "API Reference" (docs/integrators/api-reference.md)
- "Trust model" (docs/trust-model.md)
- "CLI" (cli/README.md)

---

<h2 align="center">License</h2>MIT © ALX Foundation

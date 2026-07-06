<h1 align="center">ALX Protocol</h1>

<p align="center"><strong>An open protocol for composable context</strong></p>

<p align="center">
Deterministic identity, parent-bound lineage, and locally verifiable structure for any artifact
</p>

<p align="center">
  <a href="https://github.com/xandrlabs/alx-protocol/actions/workflows/ci.yml">
    <img src="https://github.com/xandrlabs/alx-protocol/actions/workflows/ci.yml/badge.svg" alt="CI">
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT">
  </a>
  <a href="docs/integrators/on-chain-base.md" title="Optional pointer registry on Base; not required for ALX core">
    <img src="https://img.shields.io/badge/Chain-optional-0052FF" alt="Blockchain optional">
  </a>
</p>

---

> v1.0.0 · 14 artifact packages · 3 reference implementations (TypeScript, Rust, Python) · conformance suite with hash test vectors

A **Block** seals any JSON artifact and its declared parent Blocks into a single deterministic `blockHash`. The same content with the same parents always produces the same hash — on any machine, in any language, across any conformant implementation. Any modification to content or parent references produces a different hash. Verification is local recomputation: no network call, no vendor service, no chain required. Chained Blocks form a derivation graph where lineage is encoded into identity, not inferred from logs.

Full documentation at [docs.xandrlabs.ai](https://docs.xandrlabs.ai).

## Install

```bash
npm install @alx-protocol/sdk
```

Content is opaque JSON; `type` is an application-level convention, not a registered schema.

### Create a Block

```ts
import { lock, validateBlock } from "@alx-protocol/sdk";

const prompt = lock({
  type: "ai.prompt",
  text: "Analyze Q4 trends",
  model: "your-model-id",
});
// prompt.blockHash: "0x3a7f2c..."

const response = lock(
  { type: "ai.response", text: "AI infrastructure up 47% YoY", model: "your-model-id" },
  { parents: [prompt] }
);
// response.blockHash:    "0x91be4d..."
// response.parentHashes: ["0x3a7f2c..."] — bound into blockHash, not inferred from logs
```

### Validate a Block

```ts
const { ok } = validateBlock(response); // ok: true — recomputed locally, no network
```

See [Getting Started](docs/integrators/quickstart.md) for the full walkthrough.

## Integration Paths

| Goal | Use |
|---|---|
| Production Apps, Agents, Services | SDK ([TypeScript](sdk/), [Rust](reference-implementations/rust/), [Python](reference-implementations/python/)) |
| Command Line Testing & Debugging | [CLI](cli/README.md) |
| Agent Framework Handoffs | [Framework Patterns](docs/integrators/agent-frameworks.md) (LangChain, CrewAI, AutoGen) |
| Cross-Team Graph Queries | [Database Guide](docs/integrators/database-guide.md) + SDK |

---

## Documentation

- [Whitepaper](docs/whitepaper.md) — motivation, design principles, and system architecture
- [Documentation hub](docs/README.md) — paths for integrators, implementers, and reviewers
- [Getting Started](docs/integrators/quickstart.md) — install through first verified Block
- [API Reference](docs/integrators/api-reference.md) — SDK functions and types
- [Protocol specification](protocol/spec.md) — normative rules, canonicalization, and hash test vectors
- [Trust model](docs/trust-model.md) — verification scope, attestation layer, and what ALX does not verify
- [Attestations and signing](docs/integrators/extensions.md) — signatures, approvals, and proofs around Blocks
- [Agent integration](docs/integrators/agent-integration.md) — agent handoffs and lineage
- [CLI](cli/README.md) — command-line verification and debugging

---

## License

MIT © Xandr Labs

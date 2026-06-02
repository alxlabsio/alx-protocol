# AI Content Conventions

The document describes optional content conventions for AI workflows. AI content conventions remain outside the protocol specification.

---

## Purpose

Standard content patterns for AI agents operating within the ALX Protocol ecosystem. These conventions make agent pipelines interoperable and auditable without changing the protocol - content remains opaque.

## Scope

Model cards, hallucination grounding markers, and agent manifests. These are recommendations rather than requirements.

---

## Model Card Blocks

A **model card** is a Block that declares which model produced an agent's output, along with training provenance and known limitations. The model card becomes part of the lineage graph — every output Block references the model card as a parent, making full model provenance traceable.

```json
{
  "type": "agent.model-card",
  "modelId": "research-agent-v2",
  "baseModel": "llama-3.1-70b",
  "finetuning": "domain-specific financial data (2024-Q1 through 2025-Q3)",
  "trainingCutoff": "2025-09-01",
  "knownLimitations": [
    "may not reflect post-cutoff market events",
    "limited coverage of emerging markets",
    "hallucination rate ~3% on out-of-domain queries"
  ],
  "evaluationMetrics": {
    "accuracy": 0.92,
    "f1": 0.89,
    "hallucinationRate": 0.03
  },
  "provider": "acme-ai",
  "version": "2.1.0"
}
```

### Model Card Integration Steps

```js
// 1. Create the model card once (root Block - no parents)
const modelCard = createBlock({
  type: "agent.model-card",
  modelId: "research-agent-v2",
  baseModel: "llama-3.1-70b",
  knownLimitations: ["may not reflect post-cutoff events"],
  trainingCutoff: "2025-09-01",
});

// 2. Every output Block references the model card as a parent
const output = createBlock(
  { type: "research-brief", findings: [...] },
  [modelCard.blockHash, ...otherParents],
);

// 3. Auditors can trace any output back to its model card
const trace = traceAttribution(output.blockHash, graph);
// The model card appears as a leaf node - the provenance root
```

### Model Card Rationale

- **Audit trails:** Regulators can verify which model version produced a specific output
- **Reproducibility:** Researchers can identify whether a result was produced before or after a training cutoff
- **Liability:** Known limitations declared in the model card carry a creation-time timestamp, establishing when disclosure occurred
- **Version tracking:** When a model is updated, create a new model card Block - the old one's hash is permanent

---

## Hallucination Grounding

The lineage graph structurally distinguishes **grounded** outputs (derived from verified sources) from **ungrounded** outputs (generated without source references).

### Grounded Block

A Block with `parentHashes` referencing verified data sources:

```js
// Source data (verified, signed by data provider)
const marketData = await createSignedBlock(
  { type: "data.source", source: "bloomberg-terminal", data: {...} },
  [],
  dataProviderSigner,
);

// Grounded output - references the verified source
const analysis = createBlock(
  { type: "ai.response", text: "Based on Q4 data, GPU demand is up 40%", grounded: true },
  [marketData.blockHash],  // ← provenance link to verified source
);
```

### Ungrounded Block

A Block with empty `parentHashes` or no verified source references:

```js
// Ungrounded - no parent sources, purely generated
const speculation = createBlock(
  { type: "ai.response", text: "I think the market will grow", grounded: false },
  [],  // ← no source references
);
```

### Structural Detection

An auditor can detect grounding status from the graph alone:

```js
const trace = traceAttribution(output.blockHash, graph);

// If all leaves are signed data sources -> fully grounded
// If any leaf is an unsigned, parentless generation -> potentially ungrounded
const leaves = trace.leaves;
for (const leafHash of leaves) {
  const leaf = blocks.find(b => b.blockHash === leafHash);
  if (!leaf.attestations?.length && leaf.parentHashes.length === 0) {
    console.log("Ungrounded source detected:", leafHash);
  }
}
```

The protocol makes grounding **structurally visible** rather than enforcing grounding policy. Applications decide what to do with that information.

---

## Content Type Reference

| Type | Description | When to use |
|------|-------------|-------------|
| `agent.manifest` | Agent identity and capabilities | Agent's first Block |
| `agent.model-card` | Model provenance, limitations, metrics | Once per model version |
| `ai.prompt` | Input to an AI model | Before generation |
| `ai.response` | Output from an AI model | After generation |
| `ai.tool-call` | Tool/function invocation | During agent execution |
| `data.source` | Verified external data | Grounding source |
| `research-brief` | Research findings | Research agent output |
| `investment-analysis` | Synthesized analysis | Analysis agent output |
| `decision-memo` | Recommendation or decision | Decision agent output |
| `compliance-review` | Review with findings | Compliance agent output |
| `approval-record` | Sign-off with conditions | Approval agent output |
| `security-plan` | Security review scope | Planning agent output |
| `execution-report` | Completed checks | Execution agent output |

---

## Related Documents

- [`./extensions.md`](./extensions.md) - content schema conventions and adapter patterns
- [`./agent-frameworks.md`](./agent-frameworks.md) - framework-specific integration
- [`./workflows.md`](./workflows.md) - real-world pipeline examples
- [`../../artifact-packages/START-HERE.md`](../../artifact-packages/START-HERE.md) - canonical package examples for AI and machine-authored artifacts

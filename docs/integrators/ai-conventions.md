# AI Content Conventions

This document offers application-level content patterns for AI workflows. ALX core treats `content` as an ALX value and does not assign meaning to these fields.

## Status And Limits

The names below are examples, not registered protocol types. They do not establish truth, authorship, grounding, model identity, reproducibility, legal responsibility, or content quality. Applications must define and enforce those claims independently.

## Model Description Block

An application may create a Block whose content records the model configuration used in a workflow:

```ts
const modelDescription = createBlock({
  type: "agent.model-description",
  modelId: "research-model-2026-08",
  trainingCutoff: "2026-06-01",
  declaredLimitations: ["may not reflect events after the cutoff"],
});
```

An output can declare that Block as a direct parent when the output was actually derived using that configuration:

```ts
const output = createBlock(
  { type: "research-brief", findings },
  [modelDescription.blockHash, ...sourceBlockHashes],
);
```

The relationship proves only that the parent identity was declared inside the output Block's hash envelope. It does not prove that the named model ran or that the declarations are accurate.

## Source-Reference Convention

Applications may distinguish generated outputs that declare source parents from outputs that do not:

```ts
const analysis = createBlock(
  {
    type: "ai.response",
    text: "Application-generated analysis",
    sourcePolicy: "declared-parents",
  },
  [sourceBlock.blockHash],
);
```

Do not label an output “verified” or “grounded” from Graph structure alone. A parent relationship does not establish source truth, relevance, authorization, or faithful use. An application can combine Graph verification with its own source registry, attestation policy, content review, and model-run evidence.

## Optional Attestations

Portable attestations use the optional signing extension's `SignedBlock` wrapper; they are not fields on a core Block:

```ts
const signedSource = await createSignedBlock(
  { type: "data.source", sourceId: "application-source-17", value: 42 },
  [],
  signer,
);

const sourceBlock = signedSource.block;
```

Validating an attestation proves that the corresponding key signed the defined payload. Authorization, key ownership, source trust, freshness, and replay policy remain application responsibilities.

## Example Content Names

| Example `type` | Possible application use |
|---|---|
| `agent.manifest` | Declared agent configuration and capabilities |
| `agent.model-description` | Declared model version and limitations |
| `ai.prompt` | Recorded model input |
| `ai.response` | Recorded model output |
| `ai.tool-call` | Recorded tool invocation |
| `data.source` | Application-defined source material |
| `research-brief` | Synthesized research output |
| `decision-memo` | Recommendation or decision record |
| `approval-record` | Application approval claim |
| `execution-report` | Reported checks and results |

These values have no core ALX semantics. If interoperability is required, publish a versioned content profile under the optional extension rules.

## Related Documents

- [`./extensions.md`](./extensions.md) — extension and content-profile boundaries
- [`./agent-integration.md`](./agent-integration.md) — framework-neutral integration
- [`./attributed-outputs.md`](./attributed-outputs.md) — lineage-facing application patterns
- [`../../protocol/extensions/signing/README.md`](../../protocol/extensions/signing/README.md) — portable signing extension

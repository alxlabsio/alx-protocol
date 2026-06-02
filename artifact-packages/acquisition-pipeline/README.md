# Acquisition Pipeline — Verifiable Derivation Graph

Status: implemented
Authority: non-normative reference example
Protocol scope: product-facing
Audience: Integrators, adoption evaluators

A four-block derivation chain demonstrating the core ALX Protocol pattern: a governed system prompt, a user prompt, an AI response, and a downstream human decision — each locked as a verifiable Block, each declaring the previous Block as its parent.

---

## Files

| File | Role |
|------|------|
| `system-prompt-v1.json` | Full system prompt: role, instructions, constraints, output format |
| `system-prompt.block.json` | Locks `system-prompt-v1.json` — root block, no parents |
| `prompt-meridian-q4.json` | Full prompt payload: messages, attachments, deal context |
| `prompt.block.json` | Locks `prompt-meridian-q4.json` — parent: system-prompt block |
| `response-meridian-q4.json` | Full model response: text, structured sections, risk classifications |
| `response.block.json` | Locks `response-meridian-q4.json` — parent: prompt block |
| `decision-meridian-q4.json` | Full decision record: outcome, conditions, voting record, notes |
| `decision.block.json` | Locks `decision-meridian-q4.json` — parent: response block |

---

## Chain

```
system-prompt.block.json
  blockHash:    0xd71e3fb378abffdfbde0ddea0fce6fb536a19102851da826d91c52e9eceb135b
  parentHashes: []
        │
        ▼
prompt.block.json
  blockHash:    0xc03622e962ba72fcd59798de396bcaddeba27f762791d20e42b3c8ee7e35eeb3
  parentHashes: ["0xd71e3fb3..."]
        │
        ▼
response.block.json
  blockHash:    0xe38ec6a458707ec3a5957eee318e693690a7263922eb4cf2b1dc97a0eee92165
  parentHashes: ["0xc03622e9..."]
        │
        ▼
decision.block.json
  blockHash:    0x97ebf237074664b3e10721960d4ce6085358441d2681c3008cde603944fef2e7
  parentHashes: ["0xe38ec6a4..."]
```

---

## Block Content Pattern

Each block's `content` carries three things:

1. **`summary`** — one-line human-readable description; auditors read the chain at a glance
2. **`file`** — path to the verbose JSON artifact this block locks
3. **`sha256`** — SHA-256 digest of the verbose file; locked into `blockHash`, making the full artifact verifiable by hash comparison alone

```json
{
  "type": "ai.system-prompt",
  "summary": "Senior market analyst persona — institutional acquisition analysis, v1.0",
  "file": "system-prompt-v1.json",
  "sha256": "0x7a527c2bbe6eb55502df33998df579c6e074bee2da00aacd5abfd7ffeb3d4f55",
  "version": "1.0.0",
  "owner": "investment-committee",
  "effectiveDate": "2026-01-01T00:00:00.000Z"
}
```

---

## Verification

```bash
# Verify any block in the chain locally — no network, no service
node cli/bin/alx.js block verify artifact-packages/acquisition-pipeline/decision.block.json

# Verify all four
node cli/bin/alx.js block verify artifact-packages/acquisition-pipeline/system-prompt.block.json
node cli/bin/alx.js block verify artifact-packages/acquisition-pipeline/prompt.block.json
node cli/bin/alx.js block verify artifact-packages/acquisition-pipeline/response.block.json
node cli/bin/alx.js block verify artifact-packages/acquisition-pipeline/decision.block.json
```

---

## Reproducing the Chain

Reproduce the blocks from the verbose files using the CLI:

```bash
cd artifact-packages/acquisition-pipeline

# 1. Lock the system prompt
node ../../cli/bin/alx.js block create \
  --content-file system-prompt-content.json \
  --out system-prompt.block.json

# 2. Lock the prompt, parent = system prompt
node ../../cli/bin/alx.js block link \
  --content-file prompt-content.json \
  --parent system-prompt.block.json \
  --out prompt.block.json

# 3. Lock the response, parent = prompt
node ../../cli/bin/alx.js block link \
  --content-file response-content.json \
  --parent prompt.block.json \
  --out response.block.json

# 4. Lock the decision, parent = response
node ../../cli/bin/alx.js block link \
  --content-file decision-content.json \
  --parent response.block.json \
  --out decision.block.json
```

Or produce the same chain in code:

```ts
import { createBlock } from "@alx-protocol/sdk";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

function sha256(file: string) {
  return "0x" + createHash("sha256").update(readFileSync(file)).digest("hex");
}

// ── Summary generation ────────────────────────────────────────────────────────
//
// summary origin by block type:
//
//   ai.system-prompt  → human-authored. The operator names and versions
//                       the governed artifact. "v1.0" is a deliberate choice,
//                       not something a model should decide.
//
//   ai.prompt         → application code. The developer or calling service
//                       names the request at construction time, often from a
//                       template: `${dealCode} — ${requestType}`.
//
//   ai.response       → AI-generated via a second model call (shown below).
//                       The primary model produces several hundred words;
//                       a second, fast call distills that into one auditable
//                       line. Use an inexpensive model — the call adds ~200ms
//                       and the summary locks permanently into blockHash.
//
//   decision          → human-authored. The decision-maker writes the outcome
//                       statement. The summary IS the decision record.
//
// ─────────────────────────────────────────────────────────────────────────────

// Block 1 — system prompt
// summary: human-authored, versioned by the operator
const systemPrompt = createBlock({
  type: "ai.system-prompt",
  summary: "Senior market analyst persona — institutional acquisition analysis, v1.0",
  file: "system-prompt-v1.json",
  sha256: sha256("system-prompt-v1.json"),
  version: "1.0.0",
  owner: "investment-committee",
  effectiveDate: "2026-01-01T00:00:00.000Z",
}, []);

// Block 2 — prompt
// summary: set by the application at request construction time
const prompt = createBlock({
  type: "ai.prompt",
  summary: "Acquisition analysis request — Meridian Holdings Q4 2025",
  file: "prompt-meridian-q4.json",
  sha256: sha256("prompt-meridian-q4.json"),
  sessionId: "sess_01jt4kx9m2f",
  requestId: "req_7c3b8a",
  timestamp: new Date().toISOString(),
}, [systemPrompt.blockHash]);

// Block 3 — response
// Call your model provider to run the primary analysis.
const responseText = await yourModel.generate({
  system: readFileSync("system-prompt-v1.json", "utf8"),
  prompt: "Analyze the Q4 market report and recommend whether to proceed with the acquisition of Meridian Holdings.",
});

// Second model call — distill the response into one auditable line.
// Use a fast, inexpensive model; the summary locks permanently into blockHash.
const responseSummary = await yourModel.generate({
  prompt: `Summarize in one line (15 words or fewer). State the recommendation and the single most important risk:\n\n${responseText}`,
  maxTokens: 60,
}) ?? "Analysis complete";               // fallback if generation fails

// Write the verbose response file, then lock the block
writeFileSync("response-meridian-q4.json", JSON.stringify({ text: responseText }, null, 2));

const response = createBlock({
  type: "ai.response",
  summary: responseSummary,               // AI-generated one-liner, locked permanently
  file: "response-meridian-q4.json",
  sha256: sha256("response-meridian-q4.json"),
  timestamp: new Date().toISOString(),
}, [prompt.blockHash]);

// Block 4 — decision
// summary: human-authored. The decision-maker writes this — it is the outcome.
const decision = createBlock({
  type: "decision",
  summary: "Approved — proceed with Meridian Holdings acquisition, pending UK legal review",
  file: "decision-meridian-q4.json",
  sha256: sha256("decision-meridian-q4.json"),
  outcome: "approved",
  decidedBy: "investment-committee",
  // Production: pass decidedBy as a blockHash reference to a user-identity or
  // committee block so the decision-maker is itself a verifiable artifact.
  timestamp: new Date().toISOString(),
}, [response.blockHash]);
```

---

## Chain Provenance

Verify `decision.block.json` and follow `parentHashes` to establish:

- The AI response that informed the decision (`response.block.json`, `blockHash: 0xe38ec6a4...`)
- The prompt that generated that response (`prompt.block.json`, `blockHash: 0xc03622e9...`)
- The system prompt that governed the interaction (`system-prompt.block.json`, `blockHash: 0xd71e3fb3...`)
- Integrity of each verbose file (recompute SHA-256 and compare against the locked value in `content.sha256`)

Altering any verbose file changes its SHA-256, which changes the block's `contentHash` and `blockHash`, propagating a detectable mismatch through every downstream block. Tamper detection requires the four block files alone — logs, databases, and external services are all outside the verification path.

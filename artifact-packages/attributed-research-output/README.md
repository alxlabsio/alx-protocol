# Attributed Research Output

**Status:** informative
**Audience:** Reviewers, integrators
**Authority:** non-normative reference example

## Purpose

The reference example documents source attribution via per-Block `pathCount` values in a six-Block agent security review graph: three root Blocks, two intermediate Blocks, one conclusion Block.

## Scope

Six-Block graph, per-Block `pathCount` table, workflow steps, regeneration notes, and `package verify` command for committed files.

## Non-Goals

Protocol behavior remains defined in [`protocol/spec.md`](../../protocol/spec.md). The document is non-normative.

Content sourced from xandr-app agent capability and engineering pattern blocks.

---

## Blocks

| File | Type | Role | Content |
|---|---|---|---|
| `source-1.json` | Root | Execution contract | `agent.security_review` — rules governing how a security review agent must behave |
| `source-2.json` | Root | Execution contract | `agent.evaluate_artifact` — rules governing how an evaluation agent scores artifacts |
| `source-3.json` | Root | Subject under review | `blk_auth_session_model_v1` — the engineering pattern being assessed |
| `parent-1.json` | Parent | Findings | `security_findings` — applies source-1 rules to source-3 pattern |
| `parent-2.json` | Parent | Quality score | `quality_score` — applies source-2 rules to the parent-1 artifact |
| `output.json` | Conclusion | Decision | `security_review_decision` — cites parent-2, parent-1, and source-1 directly |

### Aggregate files

| File | Purpose |
|---|---|
| `blocks.json` | All six Blocks in the closed-world graph (roots, intermediates, and conclusion) for `package verify` and graph import |
| `parents.json` | The five Blocks referenced in `output.json` `parentHashes` only — same records as in `blocks.json`, excluding the conclusion Block |

`parents.json` holds the parent slice of `blocks.json` for consumers that load immediate parents from the parent slice only. Regenerate both with maintainer-local tooling under `scripts/` (gitignored) or by chaining Blocks with `alx block create`.

`manifest.json` `files` maps every package path, including per-Block JSON files and the aggregate files above.

---

## Attribution Graph

```
agent.security_review ──────────────────────────────── [direct citation in rationale]
      │                                                          │
      └──→ security_findings ──────────────────────────→ security_review_decision
      │           │                                             │
      │           └──→ quality_score ───────────────────→      │
      │                      │                                  │
agent.evaluate_artifact ─────┘
      
blk_auth_session_model_v1 ──→ security_findings ──→ [propagates through to decision]
```

---

## Attribution Result

| Block | pathCount | Depth | Interpretation |
|---|---|---|---|
| `agent.security_review` | **3** | 1 | Cited directly in the decision, governs the findings, propagates through the quality score |
| `security_findings` | **2** | 1 | Cited directly in the decision and through the quality score |
| `auth_session_model` | **2** | 2 | The subject under review — reached via findings and via quality→findings |
| `agent.evaluate_artifact` | **1** | 2 | Contributes through the quality score only |
| `quality_score` | **1** | 1 | One path from the decision |
| `security_review_decision` | **1** | 0 | Root of the trace |

`agent.security_review` has `pathCount=3` because the decision Block cites `agent.security_review` three distinct ways:
1. `decision → agent.security_review` (direct — AC-001 through AC-004 cited in rationale)
2. `decision → security_findings → agent.security_review` (the findings applied its rules)
3. `decision → quality_score → security_findings → agent.security_review` (quality score evaluated the findings artifact)

---

## Workflow

**Step 1 — Three independent sources are established as root blocks.**

`agent.security_review` defines the execution contract: required checks, evidence-only findings, and valid finding structure.

`agent.evaluate_artifact` defines the evaluation contract: how to score an artifact, how to identify repair targets, and the reproducibility invariant.

`blk_auth_session_model_v1` is the engineering pattern under review: server-managed sessions with refresh token rotation, tenant-scoped lifecycles, and immediate revocation.

**Step 2 — The security agent produces findings (parent-1).**

The agent applies `agent.security_review` rules to assess `blk_auth_session_model_v1`. Four acceptance criteria are evaluated. Three are fully met. One is partially met: all findings are grounded in block evidence, but automated test coverage for cross-tenant session leakage is absent.

**Step 3 — The evaluation agent scores the findings artifact (parent-2).**

The agent applies `agent.evaluate_artifact` rules to score the security findings. Score: 98/100. One repair target identified: FINDING-001 (cross-tenant leakage test coverage gap).

**Step 4 — A grounded decision is produced (output).**

The decision cites the quality score (parent-2), the findings directly (parent-1), and the security review acceptance criteria (source-1) by name. Verdict: `approved-with-findings`. Repair required before the next release.

---

## Regenerating This Package

Maintainers may rebuild package JSON from source Blocks using local scripts under `scripts/` (gitignored) or the CLI (`alx block create`, graph export). The committed files in this directory are the canonical examples.

---

## Verifying This Package

```bash
node cli/bin/alx.js package verify artifact-packages/attributed-research-output --json
```

Expected CLI result (`package verify --json`):

```json
{
  "ok": true,
  "complete": true,
  "missingParents": [],
  "externalParents": []
}
```

`verification.json` in the package is a fuller portable receipt. The receipt includes `cidVerified: false` because hashes are asserted at package generation time. Content-envelope recomputation is omitted. Closed-world lineage checks still return `ok: true` and `complete: true`.

---

## Related Documents

- [`../START-HERE.md`](../START-HERE.md) — canonical package index
- [`../../docs/integrators/attributed-outputs.md`](../../docs/integrators/attributed-outputs.md) — attribution workflow guide
- [`../../docs/verification-receipts.md`](../../docs/verification-receipts.md) — receipt format

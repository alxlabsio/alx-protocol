# Canonical Artifact Packages

**Status:** informative
**Audience:** Reviewers, integrators, package authors, technical evaluators
**Authority:** non-normative reference catalog

## Purpose

Catalog CI-validated reference examples that package Blocks, Attribution Traces, verification receipts, and storage manifests for inspection and `package verify`.

## Scope

Package structure, layout variants, the full package catalog, validation commands, and the design boundary between Blocks and operational envelopes.

## Non-Goals

Protocol behavior remains defined in [`protocol/spec.md`](../protocol/spec.md) and [`protocol/test-vectors/`](../protocol/test-vectors/). The document is non-normative.

Each reference example includes:

- deterministic Block identity;
- parent-bound lineage;
- explicit verification context;
- Attribution Trace output;
- portable verification receipt;
- storage manifest metadata for content-addressed storage systems.

The files are protocol-adjacent reference artifacts. Artifact packages organize Blocks, content, parent references, verification context, traces, receipts, and storage metadata for verification, tracing, inspection, and retrieval while preserving the core Block primitive.

## Normative Status

The files in the directory are reference artifacts.

The core ALX primitive remains the Block. Artifact packages organize Blocks, content, parent references, verification context, traces, receipts, and storage metadata for practical use.

A conformant ALX Block remains valid independently of any package format, storage manifest, receipt, trace, hosted service, or content-addressed storage identifier.

## Verifier Questions

A downstream verifier can determine:

1. Artifact identity from the primary Block.
2. Parent Blocks that contributed to the primary Block.
3. Whether the lineage graph is complete or bounded by declared external parents.
4. Whether the artifact validates via local recomputation.
5. Whether receipts, traces, and storage metadata compose around the Block while preserving Block identity.

The Block is the trust primitive.

The package is the operational envelope around the Block.

## Package Structure

Most packages follow this layout:

| File | Purpose |
|---|---|
| `block.json` | Primary derived Block for the package |
| `content.json` | Content payload for the primary Block |
| `blocks.json` | All Blocks included in the package |
| `parent-1.json` | First parent Block |
| `parent-2.json` | Second parent Block |
| `parents.json` | Parent Block references for the primary Block |
| `verification-context.json` | Validation mode and graph context |
| `trace.json` | Attribution Trace for the package graph |
| `verification.json` | Portable verification receipt |
| `manifest.json` | Artifact package manifest and storage mapping metadata |

### Layout Variants

| Variant | Package | Notes |
|---|---|---|
| Conclusion named `output.json` | `attributed-research-output` | Six-block graph; conclusion Block is `output.json` instead of `block.json` |
| Valid and tampered copies | `tampered-package-detection` | Run `package verify` on `valid/` and `tampered/` separately |
| Additive signing files | `signed-security-review-decision` | Adds `signed-block.json`, `attestations.json`, and `signed-verification.json` beside the core Block |
| Root context only | `agent-user-preference-profile`, `brand-voice-profile`, `restricted-language-policy` | Single root Block packages consumed as parents by derived packages |

## Canonical Packages

### `attributed-research-output`

Six-block agent security review workflow: three root Blocks, two intermediate Blocks, one conclusion Block. The Trace reports per-Block `pathCount` values across multiple paths, direct citation in rationale, and three trace leaves in a closed-world graph. See the package README for the full graph and attribution table.

### `security-review-decision`

Vendor security review decision derived from a vendor questionnaire Block and a security baseline policy Block. The package covers enterprise compliance review, cross-team decision lineage, and exportable verification evidence.

### `signed-security-review-decision`

Same security review decision with additive Ed25519 attestation files. Signing adds accountability around the Block; `blockHash` remains unchanged.

### `market-synthesis`

Research synthesis derived from a market scan Block and a customer interview Block. The package covers source-grounded synthesis and multi-system research workflows.

### `model-release-readiness`

Model release decision derived from an evaluation run Block and a release-gating policy Block. The package covers AI governance and deployment review trails.

### `open-world-private-boundary`

Privacy review decision derived from a resolved internal assessment Block and a partner assessment Block declared as an external boundary. The package covers open-world validation with declared `externalParents`.

### `tampered-package-detection`

Verified invoice-approval package paired with an intentionally altered copy. The tampered subdirectory fails `package verify` when `contentHash` no longer matches `content.json`.

### `cross-vendor-agent-handoff`

Planning recommendation derived from a research summary Block and an independent review Block from distinct agent systems. Verification replays from packaged Blocks alone.

### `decision-evolution`

Revised rollout decision derived from the original decision Block, monitoring evidence Block, and revised operating policy Block. The package preserves revision lineage across policy updates.

### `agent-user-preference-profile`

Root Block storing communication and accessibility preferences for reuse as parent context.

### `adaptive-security-response`

Personalized response Block derived from a security review decision Block and a user preference profile Block.

### `adaptive-interface-state`

Adaptive workspace state Block derived from a user preference profile Block, brand voice profile Block, restricted-language policy Block, and workflow-state Block.

### `brand-voice-profile`

Root Block storing preferred terminology, restricted terms, and voice rules for reuse as parent context.

### `context-aware-agent-response`

Generated response Block derived from a user preference profile Block, brand voice profile Block, and task request Block.

### `restricted-language-policy`

Root Block storing banned terms, replacements, and claim rules for reuse as parent context.

### `policy-constrained-agent-response`

Generated response Block derived from user preference, brand voice, restricted-language policy, and task request Blocks.

## Verification Status

Each package satisfies:

- every included Block validates;
- the primary Block validates against its parent Blocks;
- the Attribution Trace recomputes correctly;
- the verification context is structurally valid;
- the verification receipt matches the package result.

CI runs `pnpm run validate:artifact-packages` against all packages, including layout variants such as `attributed-research-output` (`output.json` primary block) and `tampered-package-detection` (`valid/` and `tampered/` subdirectories).

## Storage Manifest Status

The `manifest.json` files contain deterministic storage mapping metadata for included files, including locally recomputable CIDv1 values. Live publishing or pinning to a content-addressed storage system remains a separate operation.

ALX verifies artifact identity and lineage.

Storage systems provide retrieval and availability.

## Design Boundary

The package format sits outside the core Block primitive.

A Block remains valid independently of:

- an artifact package;
- a content-addressed storage identifier;
- a storage manifest;
- a verification receipt;
- an Attribution Trace;
- a hosted service.

The artifact package organizes surrounding systems for verification, storage, inspection, and reuse.

## Package Review Rationale

The reference examples include:

- domain-specific Blocks with explicit parent lineage;
- local verification via `package verify`;
- portable receipts;
- composability with storage and integration layers.

Reviewers, integrators, and auditors use the packages to inspect ALX behavior in representative workflows.

## Recommended Validation

From the repository root, verify an individual package:

```bash
node cli/bin/alx.js package verify artifact-packages/security-review-decision --json
```

Validate all standard-layout packages in CI:

```bash
pnpm run validate:artifact-packages
```

For lower-level Block operations on a single package:

```bash
node cli/bin/alx.js validate artifact-packages/security-review-decision/block.json \
  --graph artifact-packages/security-review-decision/blocks.json

node cli/bin/alx.js trace artifact-packages/security-review-decision/block.json \
  --graph artifact-packages/security-review-decision/blocks.json
```

## Related Documents

- [`START-HERE.md`](./START-HERE.md) — five-step reviewer walkthrough
- [`../docs/community/repository-surfaces.md`](../docs/community/repository-surfaces.md) — repository surface map
- [`../docs/integrators/adapters.md`](../docs/integrators/adapters.md) — adapter and package integration guide
- [`../docs/integrators/attributed-outputs.md`](../docs/integrators/attributed-outputs.md) — attribution workflow guide
- [`../protocol/test-vectors/`](../protocol/test-vectors/) — normative conformance vectors

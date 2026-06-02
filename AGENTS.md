# AGENTS.md — ALX Protocol

This document provides context for AI coding tools working in this repository. This document does not define protocol behavior. It is framework-agnostic. Tool-specific syntax plays no role here.

---
## 1. Core Architectural Invariants

**Do not violate these rules, ever.**

- **Layered architecture:**
  L1 Canonicalization → L2 Hash/Block → L3 Lineage/Validation → L4 Trace
  Dependencies flow **downward only**. No upward imports, no circular dependencies.
- **Functional core, imperative shell:**
  Core modules (canonicalization, hashing, block creation, lineage, trace, Merkle) are **pure functions**.
  No I/O, no `Date.now()`, no `Math.random()`, no network calls. Time and randomness are always injectable.
- **Orthogonal signing & Merkle:**
  Signing (attestation) and Merkle proofs live beside the core layers; they do not alter block identity.
  Signing is async but only in the shell; the signature's `blockHash` is identical to the unsigned version.
- **Spec is the single source of truth:**
  `protocol/spec.md` + `protocol/schemas/` + `protocol/test-vectors/` define the protocol.
  No other file may introduce normative behavior.

---

## 2. Repository Map

```
protocol/                          ← CANONICAL. Defines the protocol.
  spec.md                          ← Authoritative specification
  schemas/                         ← JSON Schema for blocks, traces
  test-vectors/                    ← Conformance test data (byte-identical output required)
sdk/                               ← Primary TypeScript SDK (@alx-protocol/sdk)
reference-implementations/
  python/                          ← Peer conformance implementation
  rust/                            ← Peer conformance implementation
docs/                              ← EXPLANATION. Must not define new protocol behavior.
  README.md                        ← Documentation hub with reader journeys
  integrators/                     ← Guides for devs using ALX in applications
  governance/                      ← RFC process, stability policy, architecture assessment
  deep-dives/                      ← Normative companions elaborating on spec sections
cli/                               ← @alx-protocol/cli workspace package; root bin.alx points here for clone-and-run DX
  bin/                             ← alx CLI entry (also exposed as root package bin)
  lib/                             ← Artifact package validator used by alx package verify
conformance/                       ← Cross-implementation suite runner and repo verification gates
  bin/                             ← Conformance runner, verify-* gates, differential-core-check
artifact-packages/                 ← Canonical sample artifact packages
maintainer/                        ← Gitignored. Editorial rubrics, brand YAML, audit scanners (see manifest.json)
  docs/                            ← Editorial standards: STYLE-GUIDE.md, DOCUMENTATION-GUIDE.md
```

---

## 3. Key Commands (TypeScript SDK)

Workspace membership is declared in `pnpm-workspace.yaml` (`sdk`, `cli`). The root `package.json` exposes `bin.alx` → `cli/bin/alx.js` so contributors can run the CLI after `pnpm build` without publishing `@alx-protocol/cli`.

Root `devDependencies` pin optional signing crypto libraries at versions compatible with signing extension test vectors: `@noble/ed25519` and `@noble/secp256k1` at v3, `@noble/curves` at v1.8.x (P-256 export path and vectors), and `ethers` at v6.13.x. Root `dependencies` include `@alx-protocol/sdk` (`workspace:*`) so conformance runners resolve the built SDK and optional peers correctly.

```bash
# Install & build
pnpm install && pnpm build

# TypeScript CI gate (matches sdk-typescript job)
pnpm run ci

# Repo verification gates only
pnpm run verify

# Run all unit tests (Node.js built-in test runner)
pnpm test

# Run the conformance suite against canonical test vectors
node cli/bin/alx.js test-vectors run

# Block workflows (content from --content-file, positional path, or stdin; @latest parent)
node cli/bin/alx.js block create --content-file ./content.json --out research.block.json
node cli/bin/alx.js block link ./next.json @latest child.block.json
node cli/bin/alx.js block list --recent

# Verify artifact packages
node cli/bin/alx.js package verify artifact-packages/adaptive-interface-state

# Extension conformance (Merkle + signing self-tests)
pnpm run test:extension

# Start the HTTP verification server
node cli/bin/alx.js serve --port 8080

# Start the Block retrieval reference server (protocol/retrieval-api.yaml)
node cli/bin/alx.js retrieval start --port 8081

# Maintainer-only regen tools (local scripts/ directory, not tracked): fixture hashes, package CIDs, etc.
```

---

## 4. Mandatory Terminology

Use EXACTLY these terms (do not substitute synonyms):

| Canonical term | Never use |
|---|---|
| Block | artifact, node, record |
| blockHash | artifact hash, ID |
| contentHash | payload hash, data hash |
| parentHashes | parent IDs, lineage IDs |
| Graph | DAG, tree (unless Merkle) |
| Trace | attribution result |
| pathCount | path weight, contribution count |
| Attestor | signer (except when discussing EIP-712 mechanics) |
| Conformance | compatibility |

---

## 5. Writing Code / Examples Rules

- All examples must use realistic, AI-agent-workflow content (market research, compliance audits, multi-vendor security reviews). Never `foo`, `bar`, `baz`.
- Code snippets in documentation must be copy-paste runnable against the latest SDK.
- Keep commentary in code minimal — put lengthy explanations in `docs/`, not comments. Maintainers: [`maintainer/rubrics/codebase-rubric.md`](./maintainer/rubrics/codebase-rubric.md) Part 13 (CC-1 through CC-12).
- Every error thrown must use `protocolError(ErrorCode.XXX, "message")` from `errors.ts`. Error codes are prefixed `ALX_`.

---

## 6. Style Guide Reference

From `maintainer/docs/STYLE-GUIDE.md`:

- **Status / Audience / Authority** header block is mandatory for every document.
- **Tone tiers:** Precision (spec, API ref), Guided (tutorials, FAQ), Advocacy (whitepaper, comparison).
- No marketing language in precision-tier docs. No logos, no taglines.
- Always include a `## Related Documents` section at the end of each file.
- If a doc describes behavior, it must be backed by test vectors or reference a spec section that is.

---

## 7. When Writing Tests

- Unit tests live in `src/__tests__/` using Node.js built-in `node:test` module.
- Conformance test vectors are in `protocol/test-vectors/` and are language-agnostic.
- For new features: first add a test vector, then implement; ensure it passes across all reference implementations.
- Use the three realistic scenarios for signing tests: multi-agent research pipeline, compliance audit trail, multi-vendor agent marketplace.

---

## 8. Important Constraints

- `pathCount` uses JavaScript `Number`. Avoid input that exceeds 2^53 — the `precisionLoss` flag on `AttributionTrace` is set on overflow.
- Replay protection timestamps are in **seconds** (`nowSeconds`), not milliseconds. `Date.now()` returns milliseconds — always divide by 1000.
- `Eip712Signer` accepts an optional `timestamp` in its constructor for deterministic testing.
- `normalizeHashes()` silently drops invalid `parentHashes` entries (by spec) and enforces `MAX_PARENTS = 256`.
- `validateBlock()` uses constant-time hash comparison via `compareHashesConstantTime()`.
- Canonicalization enforces `MAX_DEPTH = 128` nesting levels and `MAX_CANONICAL_BYTES = 16 MB`.
- The HTTP server enforces `MAX_BODY_SIZE = 10 MB` and a 30-second request timeout.
- There is no formal security audit yet — be conservative with changes to signing or canonicalization.

---

## Related Documents

- [`maintainer/docs/STYLE-GUIDE.md`](./maintainer/docs/STYLE-GUIDE.md) — documentation conventions and terminology
- [`maintainer/docs/DOCUMENTATION-GUIDE.md`](./maintainer/docs/DOCUMENTATION-GUIDE.md) — brand voice and public documentation rubric
- [`protocol/spec.md`](./protocol/spec.md) — normative protocol behavior
- [`GOVERNANCE.md`](./GOVERNANCE.md) — stewardship and change tiers
- [`CONTRIBUTING.md`](./CONTRIBUTING.md) — contribution scope and pull request requirements
- [`maintainer/README.md`](./maintainer/README.md) — gitignored maintainer layer; machine entry at [`maintainer/manifest.json`](./maintainer/manifest.json)

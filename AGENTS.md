# AGENTS.md — ALX Protocol Repository Guide

- **Status/Audience:** Repository operating policy for AI coding agents and human contributors
- **Authority:** Governs repository architecture and working practices; protocol behavior remains governed by canonical protocol sources
- **Last reviewed:** 2026-07-17
- **Canonical repository:** [github.com/xandrlabs/alx-protocol](https://github.com/xandrlabs/alx-protocol)

This guide is framework-agnostic. Tool-specific instructions MAY add execution detail but MUST preserve the authority boundaries and invariants below.

```yaml
agent_policy:
  authority: { protocol: protocol/spec.md, schemas: protocol/schemas/, vectors: protocol/test-vectors/, errors: protocol/error-codes.json }
  defaults: { validation_mode: closed-world, primitive: Block }
  block_creation: { public_api: createBlock, ergonomic_api: lock }
  destructive_git_requires_user_approval: true
```

---

## 1. Decision Path

Agents MUST complete this sequence before editing:

1. **Classify the request.** Determine the change class using Section 3. If multiple classes apply, use the strictest applicable class.
2. **Identify authority.** Read the governing authority for that class before editing. If authorities conflict, apply the conflict rule in Section 2.
3. **Check protocol impact.** If the change alters Block validity, canonicalization, hash derivation, lineage, Trace, signing semantics, or conformance, use the normative protocol workflow.
4. **Apply invariants.** Check Section 2. If the requested change violates an invariant, stop.
5. **Constrain scope.** Edit only files allowed by the change class and user-authorized request. Expanding scope requires user approval.
6. **Select verification.** Run the checks required by Section 3 and relevant commands from Section 4.
7. **Evaluate stop conditions.** If any stop condition in Section 11 applies, stop and ask for clarification before editing or continuing.

Worktree ownership rule: existing worktree changes are user-owned unless the task explicitly identifies them as agent-owned. Agents MUST preserve unrelated changes. Agents MUST NOT use destructive restoration commands, including `git reset --hard`, `git checkout --`, or broad `git restore`, without explicit user authorization.

Completion report SHOULD include files changed, authority used (for example `protocol/spec.md`, `AGENTS.md`, or `maintainer/docs/STYLE-GUIDE.md`), change class, verification commands run, commands not run and why, whether protocol behavior changed, and any created Block `blockHash` values.

---

## 2. Authority And Universal Invariants

### Domain Authority

| Domain | Governing authority | Conflict rule |
|---|---|---|
| Protocol behavior | `protocol/spec.md`, `protocol/schemas/`, `protocol/test-vectors/` | Canonical protocol sources take precedence over implementations and explanatory documents. |
| Protocol error identifiers | `protocol/error-codes.json` | The registry controls exact core error identifiers; extension registries control their own identifiers. |
| Repository architecture and work practices | `AGENTS.md` | This guide controls where changes belong and which verification applies. |
| Editorial and review quality | Public style guides and the local `maintainer/` layer | Rubrics apply within their review domain and cannot introduce protocol behavior. |
| Process and stewardship | `GOVERNANCE.md`, `CONTRIBUTING.md`, `MAINTAINERS.md` | Governance documents control review and release process, not Block validity. |

### Architectural Invariants

- **Downward-only layers:** L1 Canonicalization → L2 Hash/Block → L3 Lineage/Validation → L4 Trace. Core dependencies MUST flow downward. Circular and upward imports are prohibited.
- **Functional core, imperative shell:** Canonicalization, hashing, Block creation, lineage, Trace, and Merkle functions MUST remain pure. Core functions MUST NOT perform I/O, network access, `Date.now()`, or `Math.random()`.
- **Injected environment:** Time, randomness, storage, network access, and external identity MUST enter through explicit parameters or shell adapters.
- **Orthogonal extensions:** Signing, Merkle proofs, storage, IPFS, and contracts MUST preserve core Block identity. Signature or proof material MUST NOT enter `blockHash` derivation.
- **Canonical protocol authority:** Explanatory documents, contracts, CLIs, SDK helpers, and reference implementations MUST NOT introduce normative protocol behavior.

---

## 3. Change Classification Matrix

| Change class | Permitted scope | Test vectors | Required verification | Stop condition |
|---|---|---:|---|---|
| Normative protocol | Specification, schemas, canonical vectors, all conformant implementations | Required first | `pnpm run verify`; TypeScript, Python, and Rust conformance; native implementation tests | Behavior lacks a canonical vector or changes Block identity without an approved protocol version. |
| SDK or reference implementation | Implementation of existing canonical behavior | Required only when canonical behavior changes | Build, typecheck, affected unit tests, shared conformance, affected native tests | Implementation requires behavior absent from canonical sources. |
| CLI, server, or storage | Imperative shells, transport, persistence, retrieval, user workflows | Not required unless protocol behavior changes | CLI tests plus relevant server, package, and retrieval checks | Shell code reimplements canonicalization, hashing, validation, or Trace semantics. |
| Optional extension or contract | Signing, Merkle, IPFS, anchoring, optional schemas and adapters | Extension vectors required for extension behavior | Relevant extension runner or contract suite; core conformance regression | Extension changes `blockHash`, core validity, or makes external infrastructure mandatory. |
| Documentation or publication | Explanation, integration guidance, diagrams, publication assets | Not required unless proposing protocol behavior | Maintainer audits, link checks, executable examples, diagram-source checks | Documentation defines behavior absent from canonical sources. |
| Maintainer or repository tooling | Audits, CI, release tooling, scripts, local rubrics | Not required | Tool-specific tests, dry runs, manifest validation, affected repository gates | Tooling silently changes protocol artifacts or expands release authority. |

Normative protocol changes MUST add or update canonical test vectors before implementation. Non-normative changes MUST use the tests for their own layer and MUST avoid unnecessary vector churn.

---

## 4. Verification Command Matrix

Run commands from the repository root unless a row specifies another directory. On Windows systems where PowerShell blocks `pnpm.ps1`, use `pnpm.cmd` with the same arguments.

| Goal | Command |
|---|---|
| Baseline: install and build SDK | `pnpm install && pnpm build` |
| Baseline: type-check TypeScript | `pnpm run typecheck` |
| Baseline: repository verification gates | `pnpm run verify` |
| Run SDK tests | `pnpm test` |
| Run CLI tests | `pnpm run test:cli` |
| Run TypeScript core conformance | `pnpm run test:conformance` |
| Run external TypeScript conformance | `pnpm run test:conformance:ts` |
| Run Python conformance | `pnpm run test:conformance:python` |
| Run Rust conformance | `pnpm run test:conformance:rust` |
| Run native Python tests | `cd reference-implementations/python && python -m pytest tests` |
| Run native Rust tests | `cd reference-implementations/rust && cargo test --all-targets` |
| Run all extension suites | `pnpm run test:extension` |
| Run optional contract tests | `pnpm run test:contracts` |
| Maintainer release audit | `pnpm run maintainer:audit` |
| Full advisory audit | `pnpm run maintainer:audit:full` |
| Export whitepaper diagrams | `pnpm run docs:export-whitepaper-diagrams` |
| Block: create root | `node cli/bin/alx.js block create --content-file ./research-summary.json --out research.block.json` |
| Block: create derived | `node cli/bin/alx.js block link --content-file ./analysis.json --parent ./research.block.json --out analysis.block.json` |
| Block: preview creation | `node cli/bin/alx.js block create --content-file ./research-summary.json --dry-run --json` |
| Block: verify Block or Graph | `node cli/bin/alx.js block verify ./research.block.json` |

---

## 5. Repository Map By Responsibility

```text
protocol/                    canonical specification, schemas, vectors, extensions, chains
sdk/                         primary TypeScript SDK and core tests
reference-implementations/   Python and Rust peer implementations
conformance/                 shared runners and repository verification gates
cli/                         CLI, HTTP shells, retrieval, storage, package workflows
contracts/                   optional anchoring contracts, ABIs, deployment tests
docs/                        explanatory, implementer, integrator, governance, decision docs
docs/assets/                 reproducible publication and diagram assets
scripts/                     public build, test, and documentation utilities
maintainer/                  gitignored local rubrics, brand projections, audit scanners
```

---

## 6. Scoped Terminology

| Meaning | Required term | Scoped exceptions |
|---|---|---|
| ALX protocol primitive | Block | A Block MUST NOT be renamed as an artifact, node, or record. |
| Application-facing material | digital artifact | Allowed for source material, output, media, or files represented by or carried inside a Block. |
| Full Block identity | `blockHash` | Agents MUST NOT use artifact hash, node hash, or ID as a synonym. |
| Content-only identity | `contentHash` | Agents MUST NOT use payload hash or data hash. |
| Declared parent Block collection | `parentHashes` | Agents MUST NOT use parent IDs or lineage IDs. |
| Connected Block structure | Graph | Directed-acyclic terminology is allowed only in formal algorithm descriptions; tree applies only to Merkle trees. |
| Attribution structure | Trace | Internal implementation types MAY use graph-node terminology without renaming a Block. |
| Distinct path metric | `pathCount` | Agents MUST NOT use path weight, contribution count, or royalty score. |
| Attestation actor | Attestor | Signer is allowed only for EIP-712 mechanics or library interfaces. |
| Protocol agreement | conformance / conformant | Compatibility applies only to version or platform matrices. |
| Separate documentary object | record | Allowed for VerificationReceipt, audit record, registry record, or release record. |

---

## 7. Creating Blocks Safely

- Local repository edits do not themselves require creating a Block. Block-worthy outputs include final research reports, transformed datasets, signed decisions, and external handoffs; not Block-worthy outputs include scratch notes, temporary analysis, ordinary local code or documentation edits, formatting-only changes, and build logs.
- Block shape: a Block contains `blockHash`, `contentHash`, `parentHashes`, `content`, and optional `protocolVersion`; see [`protocol/spec.md`](./protocol/spec.md) and [`docs/integrators/agent-integration.md`](./docs/integrators/agent-integration.md). `blockHash` identifies content plus lineage, `contentHash` identifies content only, and `parentHashes` declares direct input Blocks.
- Root rule: create a root Block only when the content has no upstream inputs. Parent selection: list all direct input Blocks consumed; remove ancestors already represented by a direct parent; add independently consumed ancestors back; exclude private or unavailable parents unless open-world verification is explicit; stop if the final parent set is ambiguous.
- Application code MUST use `createBlock(content, parentHashes)` or the equivalent `lock(content, { parents })`; repository workflows SHOULD use `alx block create` for roots and `alx block link` for derived Blocks. Agents MUST NOT construct hashes or derived identity fields manually.
- Content MUST be safely canonicalizable, structured, durable, non-secret, and useful without hidden context. `stepsCompleted`, `acceptanceChecks`, and `examples` MUST be descriptive, explicit, additive, non-comparative, concise, numbered when sequential, and sufficient for downstream verification. Content MUST exclude vague summaries, transient reasoning, private references, environment-specific paths, duplicated parent data, and ordering assumptions encoded only through `parentHashes`.
- Treat a created Block as immutable. A revision creates a new Block and SHOULD reference the prior Block when the revision derives from it.
- Run `validateBlock()` immediately after creation and use closed-world Graph verification by default. Unavailable parents require explicit open-world context and declared external parents.
- Persist and transmit the serialized Block without modifying hashed fields. Report its `blockHash`, output location, validation result, validation mode, and unresolved external parents.
- Apply optional signing only after Block identity exists; signing MUST preserve `blockHash`.

---

## 8. Code, Error, And Example Rules

- Public TypeScript SDK failures representing protocol errors MUST use `protocolError(ErrorCode.XXX, message)` from `errors.ts`; error codes use the `ALX_` prefix.
- CLI, server, Python, Rust, contract, test, and tooling failures MUST follow their layer-specific error conventions.
- Core comments SHOULD explain contracts, security assumptions, and non-obvious constraints. Lengthy rationale belongs in an ADR, specification section, or explanatory document.
- Public documentation examples MUST be copy-paste runnable against the current SDK where execution applies.
- Examples MUST use realistic AI workflow content such as market research, compliance review, or multi-vendor security analysis. Placeholder names such as `foo`, `bar`, and `baz` are prohibited in public examples.
- Agents MUST preserve existing public API behavior unless the task explicitly authorizes a breaking change.

---

## 9. Documentation And Publication Rules

- Repository control and meta-normative documents MUST declare Status, Audience, Authority, and Last reviewed metadata.
- Public narrative derivatives MAY transform or omit visible editorial metadata when the canonical source retains classification and authority boundaries.
- Every Markdown document MUST end with `## Related Documents`.
- Behavior descriptions MUST link to a specification section or canonical test vector instead of duplicating normative requirements.
- Explanatory files MUST NOT introduce new protocol requirements using MUST, REQUIRED, valid, invalid, canonical, conformant, or verification language unless they cite canonical protocol authority.
- Examples, tutorials, diagrams, and README snippets are non-normative unless they are part of `protocol/test-vectors/`, `protocol/schemas/`, or explicitly cited by `protocol/spec.md`.
- Precision-tier documents prohibit marketing language. Guided documents use direct technical instruction. Advocacy documents MAY use persuasive language only when an adjacent factual statement supports the claim.
- Diagrams MUST include reproducible text source, alt text or an equivalent caption, canonical labels, and a non-color-only meaning channel.
- Generated DOCX and PDF files are non-canonical publication derivatives and MUST remain excluded from protocol authority.

---

## 10. Security-Sensitive Constraints

The following normative constraints come from [`protocol/spec.md`](./protocol/spec.md); changes require the normative workflow in Section 3.

- Closed-world Graph validation is the default. Open-world validation requires explicit verification context and declared external parents.
- `protocolVersion` is optional in v1 Block data, defaults to `"1"` when absent, and remains outside hash derivation. Unsupported versions MUST be rejected.
- `normalizeHashes()` rejects malformed collections or entries, normalizes the complete valid set, and enforces `MAX_PARENTS = 256`.
- Canonicalization enforces `MAX_DEPTH = 128`.
- `pathCount` uses JavaScript `Number`; `AttributionTrace.precisionLoss` marks overflow beyond safe integer precision.
- Replay timestamps use seconds. Code derived from `Date.now()` MUST divide milliseconds by 1000 at the imperative shell.

Implementation and operational limits MUST NOT be used to claim protocol invalidity unless the specification, schemas, or canonical vectors define the limit.

- `Eip712Signer` accepts an injectable timestamp for deterministic tests.
- `validateBlock()` uses constant-time hash comparison through `compareHashesConstantTime()`.
- HTTP limits apply at server shells; current verification limits include `MAX_BODY_SIZE = 10 MB` and a 30-second timeout.
- Signing and canonicalization changes require conservative review because no formal security audit has been completed.

---

## 11. Stop Conditions

Stop and request direction when:

- a requested behavior conflicts with canonical protocol sources;
- a change would alter canonicalization, hash derivation, Block identity, lineage semantics, or Trace results without a versioned protocol decision and vectors;
- signing, Merkle, storage, IPFS, or contracts would become part of core Block validity;
- documentation appears to introduce normative behavior;
- Block creation requires ambiguous parents, would disclose a private reference, or would persist credentials or unintended private data;
- a required authority or user-owned file is missing, contradictory, or already contains overlapping unreviewed edits;
- completion requires destructive worktree operations, release publication, external credentials, or authority beyond the request.

---

## Related Documents

- [`protocol/spec.md`](./protocol/spec.md) — normative protocol behavior
- [`CONTRIBUTING.md`](./CONTRIBUTING.md) — contribution and review process
- [`GOVERNANCE.md`](./GOVERNANCE.md) — stewardship and change tiers
- [`docs/integrators/agent-integration.md`](./docs/integrators/agent-integration.md) and [`cli/README.md`](./cli/README.md) — agent Block workflows and commands
- [`maintainer/docs/STYLE-GUIDE.md`](./maintainer/docs/STYLE-GUIDE.md) and [`maintainer/docs/DOCUMENTATION-GUIDE.md`](./maintainer/docs/DOCUMENTATION-GUIDE.md) — documentation conventions and public rubric
- [`maintainer/README.md`](./maintainer/README.md) — local audit commands and rubric map

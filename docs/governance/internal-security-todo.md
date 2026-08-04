# Internal Security Review TODO

**Status:** Active audit backlog
**Audience:** Maintainers, security reviewers, release reviewers, and independent auditors
**Authority:** Tracks internal review work; canonical protocol sources govern protocol behavior
**Last reviewed:** 2026-08-04

This checklist is the working queue for `ALX-ISR-2026-01`. Completion claims and finding dispositions remain recorded in [`internal-security-review.md`](./internal-security-review.md) and [`internal-security-findings.json`](./internal-security-findings.json).

## Immediate Queue

- [ ] Complete Phase 3 lineage, Graph, Trace, and resource-limit review.
- [ ] Complete Phase 4 signing, replay, Merkle, and optional-extension review.
- [ ] Return to Phase 5 for CLI, retrieval, Local Block Store, and HTTP-server QA.
- [ ] Complete Phases 6–9 and prepare the independent-review handoff.

## Open Phase 2 Decision

- [ ] Resolve `ALX-ISR-2026-006`: define canonical handling for unpaired UTF-16 surrogates.
- [ ] Add canonical vectors before changing acceptance behavior.
- [ ] Align TypeScript, Python, and Rust after the protocol decision.
- [ ] Run native tests, all core conformance suites, and the differential core audit.
- [ ] Record the remediation or accepted-risk disposition and independent-retest status.

## Phase 3 — Lineage, Graph, Trace, And Resource Limits

### Confirmed Behavior Requiring Remediation

- [ ] Make Python and Rust closed-world lineage validation reject unresolved parents when `knownHashes` is explicitly empty.
- [ ] Reject malformed `blockHash`, parent hash, Graph-key, and external-parent hash values in all lineage and Graph validation paths.
- [ ] Make Python and Rust reject malformed Trace roots, matching the canonical hash format enforced by TypeScript.
- [ ] Reject unsupported `validationMode` values instead of preserving an arbitrary mode string or silently applying closed-world behavior.
- [ ] Define and implement one cross-runtime `pathCount` numeric behavior consistent with the protocol's JavaScript `Number` model.
- [ ] Add `precisionLoss` to the Rust Trace model and adapter output.
- [ ] Make `verifyTrace` authenticate `precisionLoss` in every implementation.
- [ ] Make TypeScript Trace verification independent of JSON object property insertion order.
- [ ] Reject duplicate-parent Graph input before Trace propagation so edge, parent, child, and `pathCount` fields cannot disagree.
- [ ] Replace recursion-sensitive Python Graph cycle detection; the public adapter currently reaches `maximum recursion depth exceeded` on a 1,500-node acyclic chain.
- [ ] Review the isolated 20,000-node Rust stack-overflow observation without running additional high-depth probes until a bounded harness is available.
- [ ] Clarify `verifyGraph.verified` accounting when a present parent Block fails authenticity; all three runtimes currently count the authentic child while returning the Graph as invalid.

### Review Items Still Requiring A Disposition

- [ ] Test incremental validation against full `validateGraph` results for equivalent combined Graphs.
- [ ] Review normalization collisions between raw Graph keys that map to the same normalized hash.
- [ ] Review duplicate Blocks in `buildGraph` and `verifyGraph` for silent overwrite or duplicate counting.
- [ ] Review cycle issue attribution so non-cycle ancestors are not mislabeled as cycle members.
- [ ] Decide whether `addBlockToGraph` mutation is compatible with the functional-core invariant and its documented public behavior.
- [ ] Reconcile documentation that still describes omitted `knownHashes` or partial closed-world Graphs as valid.

### Vector-First Remediation And QA

- [ ] Add canonical lineage vectors for explicit empty known sets, malformed hashes, unsupported modes, and normalization boundaries.
- [ ] Add canonical Trace vectors for large path counts, `precisionLoss`, malformed roots, duplicate parents, and property-order-independent verification.
- [ ] Add canonical semantic-integrity coverage for Trace verification fields and Graph authenticity accounting where normative behavior applies.
- [ ] Add native TypeScript, Python, and Rust regression tests.
- [ ] Add a deterministic cross-runtime lineage and Trace differential audit with bounded resource cases.
- [ ] Add bounded performance tests that report time, memory, and failure behavior without risking the main test process.
- [ ] Run `pnpm build`, `pnpm run typecheck`, `pnpm test`, and `pnpm run verify`.
- [ ] Run TypeScript, Python, and Rust conformance plus both native implementation suites.
- [ ] Update the finding register with evidence, severity, remediation commits, residual risk, and independent-retest status.
- [ ] Mark Phase 3 complete only after the scoped checks pass and the worktree is committed and clean.

## Phase 4 — Signing, Replay, Merkle, And Optional Extensions

- [ ] Review EIP-712, Ed25519, and P-256 encoding, domain separation, actor checks, and failure behavior.
- [ ] Review injected timestamps, replay-window units, expiry boundaries, and deterministic replay tests.
- [ ] Review multi-attestation ordering, duplicate behavior, and algorithm dispatch.
- [ ] Review Merkle leaf normalization, duplicate leaves, odd-node promotion, proof ordering, and malformed proofs.
- [ ] Verify extension material never changes `contentHash` or `blockHash`.
- [ ] Add negative and boundary vectors before changing extension behavior.
- [ ] Run all signing, Merkle, extension, native, and core-conformance regression suites.
- [ ] Record findings and dispositions, then commit Phase 4 with a clean worktree.

## Phase 5 — CLI, Retrieval, Local Block Stores, And HTTP

This is the saved QA return point requested for CLI commands, retrieval paths, HTTP servers, and storage adapters.

- [ ] Inventory every registered CLI command, handler, help entry, documentation reference, alias, flag, and test.
- [ ] Confirm removed legacy commands and aliases have no handlers, registrations, exports, fixtures, or documentation references.
- [ ] Test CLI malformed input, exit codes, structured errors, dry runs, path confinement, overwrite behavior, and batch limits.
- [ ] Test verification and retrieval HTTP servers for 400, 404, 409, 413, and timeout behavior.
- [ ] Review authentication expectations, rate limits, error disclosure, CORS, request smuggling boundaries, and graceful shutdown.
- [ ] Verify every fetched or stored Block is authenticated at the trust boundary.
- [ ] Test Memory, Browser, File, and Database Block Store contracts where implementations exist.
- [ ] Test Local Block Store `put`, `get`, `list`, `has`, and `remove` semantics, including tampering, concurrency, atomic writes, and local removal.
- [ ] Verify storage and retrieval code delegates canonicalization, hashing, validation, and Trace behavior to the SDK.
- [ ] Run CLI, server, retrieval, adapter, integration, and adversarial-input tests.
- [ ] Record findings and dispositions, then commit Phase 5 with a clean worktree.

## Phase 6 — Contracts And Chain Assumptions

- [ ] Review `ALXAnchor` first-write, duplicate, batch, timestamp, sender, event, and gas behavior.
- [ ] Review deployment configuration, chain identifiers, ownership, verification, and undeployed-status claims.
- [ ] Confirm anchoring records do not claim Block validity, authorship, or creation time.
- [ ] Run contract tests and record findings and dispositions.

## Phase 7 — Supply Chain, Build, And Release

- [ ] Audit production and development dependencies across JavaScript, Python, Rust, and Solidity tooling.
- [ ] Review package exports, lockfiles, generated artifacts, workflow permissions, secret boundaries, and release targets.
- [ ] Verify published SDK and CLI contents, provenance, checksums, SBOMs, and version alignment.
- [ ] Review vulnerability intake, incident response, release rollback, and disclosure controls.
- [ ] Record findings and dispositions.

## Phase 8 — Remediation And Regression Assurance

- [ ] Close or explicitly accept every medium and low finding with owner, rationale, and review date.
- [ ] Ensure every critical and high finding is remediated and marked for independent retest.
- [ ] Run bounded fuzzing and differential tests across protocol-critical implementations.
- [ ] Measure coverage for security-sensitive branches and document justified gaps.
- [ ] Run the complete repository verification and audit matrix.
- [ ] Confirm all remediation commits are coherent and the worktree is clean.

## Phase 9 — Audit-Candidate Freeze And Handoff

- [ ] Select one immutable audit-candidate commit and optional protected release-candidate tag.
- [ ] Regenerate the baseline manifest and verify all recorded hashes.
- [ ] Capture toolchain, dependency, test, audit, and worktree evidence.
- [ ] Prepare the independent-review scope package, unresolved-risk register, and reproduction commands.
- [ ] Assign an independent auditor and record review dates.
- [ ] Publish or link the final independent report only after external completion.
- [ ] Update the publication record without claiming independent assurance prematurely.

## Related Documents

- [`internal-security-review.md`](./internal-security-review.md) — phased review record and completion criteria
- [`internal-security-findings.json`](./internal-security-findings.json) — machine-readable findings and dispositions
- [`internal-security-baseline.json`](./internal-security-baseline.json) — immutable Phase 1 review baseline
- [`security-audit.md`](./security-audit.md) — independent audit scope and publication requirements
- [`../../AGENTS.md`](../../AGENTS.md) — repository authority and verification policy

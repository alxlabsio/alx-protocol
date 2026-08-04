# Internal Security Review

**Status:** Internal review in progress; independent review pending
**Audience:** Maintainers, security reviewers, release reviewers, and independent auditors
**Authority:** Records internal review methods, evidence, findings, and remediation status; canonical protocol sources govern protocol behavior
**Last reviewed:** 2026-08-04

This document records the phased internal security review for ALX Protocol by Xandr Labs. The review produces maintainer-authored evidence and does not constitute independent assurance.

---

## Purpose

The internal review identifies security defects, records reproducible evidence, and prepares a bounded release candidate for independent review. Each finding links an affected surface to a reproduction, disposition, remediation commit, and regression check.

The active implementation and QA queue is maintained in [`internal-security-todo.md`](./internal-security-todo.md).

## Scope

The review covers the protocol core, reference implementations, conformance infrastructure, optional cryptographic extensions, CLI and HTTP shells, Local Block Stores, the optional `ALXAnchor` contract, dependencies, and release controls. The detailed path inventory and file hashes are recorded in [`internal-security-baseline.json`](./internal-security-baseline.json).

## Non-Goals

The internal review cannot provide an independent audit opinion. The review excludes content truth, hosted-service operations, external storage availability, user identity, economic policy, and planned XNDR.network infrastructure.

## Review Target

| Field | Value |
|---|---|
| Review ID | `ALX-ISR-2026-01` |
| Baseline commit | `487cd46810766962dd6b5399314162d6832212b2` |
| Baseline capture | `2026-08-04T00:15:41.004Z` |
| Protocol version | `1` |
| Baseline worktree | Clean |
| Baseline manifest | [`internal-security-baseline.json`](./internal-security-baseline.json) |
| Finding register | [`internal-security-findings.json`](./internal-security-findings.json) |

Remediation commits remain separate from the baseline. The final audit-candidate phase records a new immutable commit and regenerates the baseline manifest.

## Review Phases

| Phase | Review Surface | Status | Completion Evidence |
|---|---|---|---|
| 1 | Baseline, scope, evidence model, and finding register | Complete | Clean baseline commit, hashed surface manifest, tested capture utility |
| 2 | Canonicalization, hashing, Block identity, and cross-language divergence | Complete | 31 canonical vectors, 5,000-case differential probe, native tests, and six recorded findings |
| 3 | Lineage, Graph validation, Trace, limits, and denial-of-service behavior | Pending | Complexity review, boundary tests, resource-limit results, recorded findings |
| 4 | Signing, replay protection, Merkle proofs, and optional extensions | Pending | Algorithm review, negative tests, domain and replay analysis, recorded findings |
| 5 | CLI, retrieval, storage, HTTP boundaries, and adversarial inputs | Pending | Shell-boundary review, input-limit tests, path and authentication analysis |
| 6 | `ALXAnchor`, deployment configuration, and chain assumptions | Pending | Contract analysis, contract suite, gas and duplicate-behavior evidence |
| 7 | Dependencies, build, release, artifact provenance, and incident controls | Pending | Audit output, workflow review, release-integrity and response evidence |
| 8 | Remediation and regression assurance | Pending | Remediation commits, regression tests, fuzzing, coverage, and complexity evidence |
| 9 | Audit-candidate freeze and independent-review handoff | Pending | Clean candidate commit, regenerated baseline, scope package, final internal report |

## Review Method

Each substantive phase applies five review methods:

1. Trace canonical requirements to implementation symbols and tests.
2. Inspect trust-boundary code for fail-open behavior, ambient authority, and duplicated protocol logic.
3. Exercise malformed, boundary, and adversarial inputs.
4. Compare independent implementations where protocol behavior applies.
5. Record every confirmed issue, accepted risk, and false positive in the finding register.

Automated tests supply evidence within the review. Finding closure also requires manual evidence and a recorded disposition. Test results establish only the behavior exercised by their cases.

## Phase 2 Evidence

The protocol-core review traced [canonicalization](../../protocol/spec.md#2-canonicalization), [identity](../../protocol/spec.md#3-identity), parent normalization, and semantic Block validation across TypeScript, Python, and Rust. Reproducible evidence includes:

- canonical vectors C28-C31 for UTF-16 ordering and numeric boundary behavior;
- negative vector CN10 for integral-valued exponent forms outside the safe integer range;
- semantic vectors SV7-SV8 for non-canonical stored identity fields;
- TypeScript in-language tests for sparse arrays, shared references, and recursion-state isolation;
- [the core differential audit](../../scripts/security/audit-core-differential.mjs), which replays all 31 exact vectors and 5,000 deterministic accepted IEEE 754 values across all three runtimes;
- native Python and Rust vector suites plus external conformance runs.

The review recorded four remediated critical findings, one remediated medium finding, and one open medium interoperability finding. ALX-ISR-2026-006 requires a canonical protocol decision on unpaired UTF-16 surrogate handling; no acceptance behavior was changed without that authority.

## Finding Records

Finding identifiers use `ALX-ISR-YYYY-NNN`. Each record contains:

- title, severity, status, phase, and affected baseline commit;
- file, symbol, trust boundary, and exploit preconditions;
- evidence and deterministic reproduction steps;
- impact and severity rationale;
- remediation commit and regression evidence;
- disposition, residual risk, owner, and review date.

Finding status values are `open`, `remediated`, `accepted`, `false-positive`, and `independent-retest-pending`. Severity follows [`../../SECURITY.md`](../../SECURITY.md).

## Phase Acceptance

A phase completes when its scoped paths have review evidence, all confirmed issues have finding records, and the applicable verification commands pass. Critical and high findings remain release-blocking until remediation and independent retest. Accepted medium and low risks require a named owner, rationale, and review date.

## Current Finding Summary

| Severity | Open | Remediated | Accepted | False Positive |
|---|---:|---:|---:|---:|
| Critical | 0 | 4 | 0 | 0 |
| High | 0 | 0 | 0 | 0 |
| Medium | 1 | 1 | 0 | 0 |
| Low | 0 | 0 | 0 | 0 |

Phase 1 established review controls. Phase 2 has completed remediation and first-pass regression checks for five findings; the unpaired-surrogate policy finding remains open pending a canonical protocol decision.

## Independent Review Boundary

The final internal handoff identifies reviewed commits, methods, unresolved risks, test evidence, and exclusions. An external reviewer must independently reproduce the relevant evidence, evaluate findings, and sign or publish the final audit report before the repository can claim independent audit completion.

## Related Documents

- [`security-audit.md`](./security-audit.md) — independent audit scope, evidence requirements, and publication record
- [`internal-security-baseline.json`](./internal-security-baseline.json) — Phase 1 repository, toolchain, file, and aggregate hashes
- [`internal-security-findings.json`](./internal-security-findings.json) — machine-readable finding and phase register
- [`internal-security-todo.md`](./internal-security-todo.md) — active implementation and QA backlog
- [`audit-core-differential.mjs`](../../scripts/security/audit-core-differential.mjs) - deterministic cross-runtime Phase 2 audit
- [`security.md`](./security.md) — threat model and trust boundaries
- [`../../SECURITY.md`](../../SECURITY.md) — severity, response, and disclosure policy
- [`../../AGENTS.md`](../../AGENTS.md) — repository architecture and verification requirements

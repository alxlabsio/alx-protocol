# Independent Security Audit Readiness

**Status:** Audit readiness record; independent review pending
**Audience:** Independent auditors, maintainers, release reviewers, and contract engineers
**Authority:** Defines audit scope, evidence, and completion records; canonical protocol sources govern protocol behavior
**Last reviewed:** 2026-08-03

This document prepares ALX Protocol by Xandr Labs for independent security review. This document is non-normative and records no completed audit.

---

## Purpose

This document gives an independent reviewer a bounded code surface, a reproducible verification matrix, and explicit completion criteria. A published audit report must identify one immutable repository commit or tag.

## Scope

The review covers protocol-critical implementations, optional cryptographic extensions, imperative shells, storage adapters, conformance infrastructure, and the optional `ALXAnchor` contract.

## Non-Goals

The review excludes content truth, application policy, hosted service operations, external storage availability, and undeployed network infrastructure. The review cannot establish protocol conformance independently of the canonical specification, schemas, and test vectors.

## Current Review Status

| Review Surface | Status | Release Boundary |
|---|---|---|
| Protocol core and reference implementations | Independent review pending | Repository tests and conformance provide internal evidence only |
| Signing and Merkle extensions | Independent review pending | Extensions remain outside core Block identity |
| `ALXAnchor` contract | Implemented, independent review pending, not deployed | Mainnet deployment remains blocked pending review |
| Production JavaScript dependency graph | No known advisory reported for dependency commit `79ee792` | Re-run `pnpm audit --prod --audit-level low` for the audit target |
| Hardhat 2 development graph | Residual transitive advisories recorded | Private contract tooling; excluded from published packages and runtime dependencies |

No repository document may describe ALX Protocol or `ALXAnchor` as independently audited until the publication record in this document is complete.

## Audit Target Freeze

Audit kickoff records these values before review begins:

| Field | Required Evidence |
|---|---|
| Repository | `https://github.com/xandrlabs/alx-protocol` |
| Target commit | Full 40-character Git commit hash |
| Target tag | Signed or protected release-candidate tag when available |
| Worktree state | Empty output from `git status --porcelain` |
| Dependency state | Committed `pnpm-lock.yaml`, Python project metadata, and Rust `Cargo.lock` |
| Protocol state | `protocol/VERSION` and hashes of canonical specification, schemas, and vectors |
| Toolchain state | Node, pnpm, Python, Rust, and Solidity compiler versions |

Remediation changes produce a new commit. The auditor records the original target and every reviewed remediation commit.

## Review Surface

| Area | Primary Paths | Security Focus |
|---|---|---|
| Canonicalization and Block identity | `protocol/`, `sdk/src/canonicalization.ts`, `sdk/src/hash-utils.ts`, `sdk/src/block.ts` | Cross-runtime determinism, input rejection, depth and parent limits, constant-time comparisons |
| Lineage and Trace | `sdk/src/block-lineage.ts`, `sdk/src/block-trace.ts` | Cycle handling, closed-world defaults, external-parent boundaries, path-count overflow |
| Peer implementations | `reference-implementations/python/`, `reference-implementations/rust/` | Behavioral parity, parser differences, integer and Unicode edge cases |
| Signing and replay protection | `sdk/src/eip712.ts`, `sdk/src/ed25519.ts`, `sdk/src/p256.ts`, `sdk/src/replay.ts`, `protocol/extensions/signing/` | Domain separation, signature encoding, signer recovery, replay windows, injected time |
| Merkle extension | `sdk/src/merkle.ts`, `protocol/extensions/merkle/` | Leaf normalization, duplicate behavior, proof verification, sorted-pair assumptions |
| CLI and HTTP shells | `cli/` | Input limits, path handling, authentication boundaries, rate limits, error disclosure |
| Local Block Stores | `adapters/` | Path confinement, atomic writes, stored Block validation, local removal semantics |
| Optional contract | `contracts/src/ALXAnchor.sol` | First-write semantics, timestamp and sender packing, batch limits, duplicate handling, gas bounds |
| Conformance infrastructure | `conformance/`, `protocol/test-vectors/` | Runner independence, negative-case coverage, fixture integrity, false-positive conformance |
| Supply chain and release | `package.json`, `pnpm-lock.yaml`, `.github/` | Dependency provenance, workflow permissions, release target integrity, advisory handling |

## Required Review Properties

The independent review evaluates these properties against canonical protocol sources:

1. Identical supported inputs produce identical canonical bytes, `contentHash`, and `blockHash` values across TypeScript, Python, and Rust.
2. Signing, Merkle proofs, storage, HTTP behavior, and contract records leave core Block identity unchanged.
3. Core functions remain independent of network access, storage, ambient time, and ambient randomness.
4. Closed-world Graph verification rejects unresolved parents by default, and open-world verification requires explicit external-parent context.
5. Malformed inputs, excessive depth, excessive parent counts, cycles, tampered Blocks, and invalid proofs fail closed.
6. Signing implementations enforce algorithm-specific encoding, domain separation, expected actor checks, and replay controls.
7. Shell and storage code delegates canonicalization, hashing, lineage, and Trace behavior to conformant implementations.
8. `ALXAnchor` records submitted hashes without claiming content validity, authorship, or creation time.

## Required Evidence

The audit report records results for the commands applicable to the target:

```bash
pnpm install --frozen-lockfile
pnpm run ci
pnpm run typecheck
pnpm run test:contracts
pnpm run maintainer:audit:full
pnpm audit --prod --audit-level low
pnpm run test:conformance:ts
pnpm run test:conformance:python
pnpm run test:conformance:rust
cd reference-implementations/python && python -m pytest tests
cd reference-implementations/rust && cargo test --all-targets
```

The full `pnpm audit` result accompanies the report as supply-chain context. Development-only findings require a documented exposure analysis and upgrade plan. The production audit remains the runtime dependency gate.

## Finding Classification

The severity definitions and response targets in [`../../SECURITY.md`](../../SECURITY.md) apply to audit findings. Every finding record contains:

- affected commit and file or symbol;
- exploit preconditions and affected trust boundary;
- reproduction or proof of concept;
- severity and rationale;
- remediation commit;
- regression test or canonical vector when protocol behavior is involved;
- auditor retest result;
- residual risk and disposition.

## Completion Criteria

Independent audit status requires all of these records:

1. An auditor independent of the implementation authors identifies the reviewed commit, methods, scope, and exclusions.
2. The auditor publishes or signs a final report with all findings and dispositions.
3. Critical and high findings are remediated and independently retested before release or deployment.
4. Accepted medium and low risks have named owners, rationale, and review dates.
5. Remediation passes the complete verification matrix for every affected implementation and extension.
6. The repository links the final report and reviewed commit from the publication record below.

## Publication Record

| Field | Current Value |
|---|---|
| Auditor | Unassigned |
| Audit target | Unassigned |
| Review dates | Unassigned |
| Final report | Unpublished |
| Remediation commits | None recorded |
| Independent retest | Pending |
| Audit status | Pending |

## Residual Risk Register

| Risk | Current Control | Required Closure |
|---|---|---|
| No independent review | Conformance, native tests, contract tests, threat model | Complete the publication record with an independent report |
| Hardhat 2 transitive development advisories | Private toolchain, clean production dependency audit, pinned lockfile | Upgrade or replace the toolchain when a compatible patched path exists |
| Undeployed `ALXAnchor` | Deployment state remains `not deployed` | Complete contract review and deployment approval |
| Signing and canonicalization assurance | Canonical vectors and cross-runtime suites | Independent cryptographic and parser review |

## Related Documents

- [`../../SECURITY.md`](../../SECURITY.md) — vulnerability reporting and severity policy
- [`security.md`](./security.md) — threat model and trust boundaries
- [`../trust-model.md`](../trust-model.md) — verification scope summary
- [`../../AGENTS.md`](../../AGENTS.md) — repository architecture and verification requirements
- [`../../contracts/README.md`](../../contracts/README.md) — optional contract status and deployment boundary

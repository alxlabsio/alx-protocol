# ALX Protocol Repository Guide

This guide governs the repository unless a compatible nested `AGENTS.md` provides more specific rules.

## Instruction and protocol authority

Apply instructions in this order:

1. the current user task;
2. the nearest applicable nested `AGENTS.md`;
3. this root guide;
4. governance and contribution policy; and
5. local maintainer guidance.

ALX Protocol behavior is governed collectively by:

- [`protocol/spec.md`](protocol/spec.md);
- [`protocol/schemas/`](protocol/schemas/);
- [`test-vectors/`](test-vectors/); and
- [`protocol/error-codes.json`](protocol/error-codes.json).

[`protocol/suites.json`](protocol/suites.json) is the required-suite discovery manifest. Implementations, examples, CLIs, contracts, documentation, applications, and ALX Labs products do not independently define protocol behavior.

## Repository map

| Path | Responsibility |
|---|---|
| `protocol/` | Canonical specification, schemas, manifests, fixtures, and optional extensions |
| `test-vectors/` | Canonical language-neutral conformance data |
| `conformance/` | Shared runners and repository alignment gates |
| `sdk/` | Primary TypeScript implementation |
| `reference-implementations/` | Maintained Python and Rust implementations |
| `tests/` | Executable unit, integration, security, fuzz, and tooling tests |
| `cli/` | CLI, local servers, retrieval, and Graph-query shells |
| `adapters/` | Optional local persistence adapters |
| `contracts/` | Optional external anchoring contract |
| `docs/` | Explanatory, implementation, integration, decision, and governance material |
| `scripts/` | Deterministic repository verification and generation tooling |

Maintainer records, active security review, local reports, generated output, secrets, caches, and XNDR application code are outside the public protocol publication set.

## Before changing files

1. Inspect `git status --short` and preserve unrelated user-owned changes.
2. Classify the change as canonical protocol, implementation, shell/adapter, extension, documentation, test, or tooling work.
3. Read the nearest guide and governing canonical sources.
4. Decide whether behavior, public API, conformance claims, or release artifacts change.
5. Select the smallest safe scope and applicable verification commands.
6. Check the stop conditions below.

## Protocol invariants

- `Block` is the sole protocol primitive and contains five v1 fields.
- Use `contentHash` for content identity and `blockHash` for complete Block identity.
- `parentHashes` contains declared direct parents; reverse children and descendants are derived application/indexer views.
- Block validation and Graph verification are separate claims.
- Canonical Graph statuses are `valid`, `invalid`, `incomplete`, and `resource_limit_reached`; `not_checked` is not a status.
- Missing required data is not invalid without an independent violation.
- Verification results are interpreted only with their Verification Context.
- `pathCount` is an exact structural value, not authorship, quality, ownership, or economic weight.
- Storage, discovery, indexing, Explorers, consensus, tokens, networks, and hosted services remain outside ALX Core.
- Signing, Merkle proofs, content profiles, adapters, and anchoring remain optional.

## Change coupling

| Change | Minimum coupled review |
|---|---|
| Canonical behavior | Specification, schemas, vectors, errors, suites, all maintained implementations, cross-language conformance |
| Public SDK API | Source, exports, package README, focused tests, compatibility/migration notes |
| CLI/server/storage | Shell tests, input/output contracts, protocol delegation, operational limits |
| Extension | Extension README, manifest, schema/errors/vectors, claiming implementations, core regression |
| Documentation | Authority, terminology, examples, inbound links, publication boundary |
| Tooling/release | Focused tooling tests, nonmutation, clean staged-snapshot behavior |

Never change expected vectors merely to match one implementation. Resolve authority first.

## Verification commands

Run from the repository root. Use the smallest applicable progression:

```bash
pnpm run format:check
pnpm run build
pnpm run typecheck
pnpm run test:unit
pnpm run test:integration
pnpm run verify:protocol
pnpm run verify:cross-language
pnpm run verify
```

Additional gates include `pnpm run test:security`, `test:fuzz`, `test:extension`, `test:contracts`, `lint:python`, and `lint:rust`. Root [`package.json`](package.json) scripts are authoritative if commands change.

## Worktree and security safety

- Preserve unrelated edits and staging. Do not use destructive Git commands or rewrite history without explicit authorization.
- Do not delete untracked or generated material unless the task clearly includes it and the exact target is verified.
- Never commit credentials, private keys, tokens, private findings, or personal data.
- Treat canonicalization, hash derivation, raw ingress, Graph verification, signing, Merkle proofs, path handling, and contract anchoring as security-sensitive.
- Keep default tests deterministic, offline, bounded, and free of real credentials.

## Stop conditions

Stop and request direction when:

- canonical sources conflict or do not define required behavior;
- identity, canonicalization, Graph outcomes, Trace, or validity would change without a versioned decision and vectors;
- an optional extension would become part of core validity;
- a public API break, deployment, publication, credential use, or destructive migration lacks authorization;
- unrelated user-owned work would be overwritten; or
- Block creation requires ambiguous parents or would expose sensitive data.

## Completion report

Report files changed, change classification, governing authority, verification run, omitted commands and why, protocol-visible impact, public API/data migration impact, and remaining risks. Do not commit, tag, publish, deploy, or push unless explicitly requested.

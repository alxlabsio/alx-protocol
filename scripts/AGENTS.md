# Repository Scripts Guide

The root [`AGENTS.md`](../AGENTS.md) remains applicable. This guide governs `scripts/`.

## Role and safety boundary

Scripts automate deterministic repository operations: formatting checks, canonical artifact checksums, signing-vector generation, protocol-site generation, and full release verification. Scripts do not define protocol behavior.

## Local invariants

- Default/check modes are read-only and fail on drift.
- Write modes are explicit, deterministic, idempotent, and limited to named generated targets.
- Resolve repository paths without relying on the caller's current directory.
- Invoke subprocesses without a shell where possible; preserve exit status and useful diagnostics.
- Bound input/output and avoid network, credentials, and private maintainer dependencies in release gates.
- Never modify canonical sources during verification.
- Generated checksums cover the manifest-selected canonical artifacts and use LF-stable bytes.
- Formatting checks work both in a Git worktree and an exported staged snapshot.
- Do not hide failures, silently repair reviewed data, or treat generated implementation agreement as protocol authority.

## Change rules

- Add focused tooling tests under `tests/unit/tooling/` for path, subprocess, strict-input, nonmutation, deterministic-generation, and failure behavior.
- Update root scripts/workflows/documentation together when a public command changes.
- Keep internal audits and release credentials outside public scripts.
- Use explicit `--check`/`--write` naming for generation when practical.
- Inspect generated diffs before staging; unexpected canonical changes are a stop condition.

## Verification

From the repository root:

```bash
node --test tests/unit/tooling
pnpm run format:check
pnpm run protocol:checksums:check
pnpm run protocol:signing-vectors:check
pnpm run protocol:site:check
```

Run `pnpm run verify` for repository-gate changes. Test from a clean staged export when release behavior or ignored-file independence changes.

## Stop conditions

Stop if verification mutates sources, output depends on platform order/line endings/time/network, a computed path can escape the intended target, a script references ignored/private files, or regeneration changes reviewed canonical output unexpectedly.

## Completion evidence

Report command/check/write behavior, generated targets, nonmutation evidence, platform/snapshot checks, focused tests, and any canonical checksum impact.

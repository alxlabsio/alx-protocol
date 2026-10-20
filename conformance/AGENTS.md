# ALX Conformance Tooling Guide

The root [`AGENTS.md`](../AGENTS.md) remains applicable. This guide governs the runner and verification tooling under `conformance/`.

## Scope and role

This directory executes the language-neutral suites declared by ALX. It discovers canonical inputs, invokes maintained or external implementations, compares results, and enforces repository alignment. It does not define protocol semantics independently.

## Governing sources

Use these sources in order:

1. [`../protocol/spec.md`](../protocol/spec.md), [`../protocol/schemas/`](../protocol/schemas/), and [`../protocol/error-codes.json`](../protocol/error-codes.json) for normative behavior.
2. [`../protocol/suites.json`](../protocol/suites.json) as the sole public suite-discovery manifest.
3. The manifest-selected files in [`../test-vectors/`](../test-vectors/) for canonical inputs and expected results.
4. [`README.md`](README.md) for the external adapter contract and runner usage.

When an implementation and expected result disagree, do not change the expected result to make the runner pass. Establish which canonical source is wrong and follow protocol governance.

## Local invariants

- Suite discovery is manifest-driven; do not hard-code a second suite inventory or historical vector count.
- Required suite membership, paths, comparison modes, counts, and checksums must agree with `protocol/suites.json`.
- Exact cases compare the complete declared result. Semantic comparison may ignore only fields the applicable suite explicitly defines as non-normative.
- Every `validateGraph` result comparison is exact, including deterministic counts and diagnostic collections.
- Human-readable error text is non-normative; canonical `ALX_*` identifiers are compared where the suite requires them.
- Differential verification checks every implementation against canonical expected output before pairwise comparison. Majority agreement is never an oracle.
- Order perturbation and repeat execution must not change deterministic results.
- The line-delimited JSON adapter contract is one request and one response per line. Diagnostics belong on stderr, not stdout.
- External processes must remain bounded by documented time, output, and input limits and must be terminated cleanly after failure.
- Language-native cases that cannot cross the JSON adapter boundary must be reported accurately, not silently counted as portable passes.
- Generated evidence belongs under ignored artifact paths and must not modify canonical sources.

## Change coupling

- Runner-only refactors should not change canonical files or expected outcomes.
- Adding an operation requires the manifest/schema model, runner dispatch, maintained adapters, tests, and documentation to agree.
- Adding or changing a canonical suite requires its vectors, manifest entry, checksum, comparison semantics, and all claiming implementations to change together.
- Changes to exact-result comparison require focused tooling tests and a complete review of affected suites.
- Changes to process execution, strict JSON, repository-root resolution, or path handling require adversarial tests.
- Extension runners remain separate from core conformance and must not broaden a core claim.

## Verification

Run focused tooling tests first, then the applicable gate from the repository root:

```bash
node --test tests/unit/tooling
pnpm run verify:suites
pnpm run verify:schemas
pnpm run verify:fixtures
pnpm run test:conformance
```

For maintained cross-language behavior, also run:

```bash
pnpm run verify:cross-language
```

For a repository-wide or release-facing conformance change, run:

```bash
pnpm run verify:protocol
pnpm run format:check
```

Run `pnpm run test:extension` only when extension discovery, comparison, adapters, or runners change.

## Stop conditions

Stop and request direction if:

- canonical sources conflict or leave comparison semantics ambiguous;
- a proposed shortcut would treat implementation agreement as correctness;
- a required maintained implementation cannot express a new canonical operation;
- a change would hide, reclassify, or inflate skipped cases in a conformance claim;
- verification needs unpublished vectors, private tooling, credentials, or network access;
- generated output would overwrite reviewed canonical data without an explicit write task.

## Completion evidence

In addition to the root completion report, state the suites and comparison modes affected, portable/native coverage, maintained implementations exercised, skipped cases, and evidence artifact location when differential verification ran.

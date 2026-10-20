# AGENTS.md -- ALX Protocol Test-Vectors Guide

## Repository Overview

This directory contains canonical, language-neutral ALX Protocol vector data. It contains no executable test code.

## Authority

Vector inputs and expected outputs are normative together with `protocol/spec.md`, `protocol/schemas/`, and `protocol/error-codes.json`. `protocol/suites.json` is the sole public discovery entry point and governs required suite membership.

## Vector Philosophy

Vectors state what a conforming implementation produces. Executable consumers belong in `tests/conformance/`; vector validation and repository operations belong in `scripts/` or `conformance/` tooling.

## Naming

Place vectors under the applicable `canonicalization/`, `identity/`, `blocks/`, or `graphs/` concern. Preserve suite IDs and deterministic vector IDs.

## Expected Outputs

Do not change expected output to match an implementation. Resolve governing semantics first and update all affected canonical sources together.

## Breaking Changes

Changing an existing expected output or required suite membership is protocol-visible and requires the repository governance, version, and cross-language conformance process.

## Cross-language Consistency

TypeScript, Python, and Rust implementations claiming a suite must consume the same file identified by `protocol/suites.json`.

## Generation

Generation must be deterministic. Generators belong in `scripts/` and must not silently rewrite reviewed expected outputs.

## Verification

From the repository root:

```bash
pnpm run verify:suites
pnpm run verify:schemas
pnpm run protocol:checksums:check
pnpm run test:conformance
pnpm run verify:cross-language
pnpm run format:check
```

Use checksum or signing-vector write commands only when regeneration is explicitly authorized, then inspect the complete diff and rerun check mode.

## Stop Conditions

Stop if the specification, schema, and expected result disagree; suite comparison semantics are unclear; an expected result would change only to match one implementation; or a portable value cannot be represented consistently across maintained implementations.

## Completion Evidence

Report suites/vector IDs changed, normative behavior and compatibility impact, manifest/count/checksum changes, maintained implementations exercised, and any native-only cases or skips.

## Related Documents

- [`README.md`](README.md)
- [`../protocol/spec.md`](../protocol/spec.md)
- [`../protocol/suites.json`](../protocol/suites.json)
- [`../tests/conformance/`](../tests/conformance/)

# ALX Executable Tests Guide

The root `AGENTS.md` remains applicable.

## Scope

This directory contains executable test code only. Canonical language-neutral inputs and expected outputs belong in `../test-vectors/`; repository operations belong in `../scripts/`.

Language- and tool-native suites may remain in `reference-implementations/*/tests/` and `contracts/test/` when their runners require package-local discovery.

## Categories

- `unit/` contains deterministic component tests.
- `conformance/` consumes canonical vectors without redefining them.
- `security/` contains deterministic adversarial and boundary regressions.
- `fuzz/` contains property-based or seeded fuzz tests and remains outside `pnpm test`.
- `integration/` contains cross-package and CLI tests.

## Rules

- Tests must not mutate canonical vectors or repository source files.
- Tests requiring network services, credentials, or deployed infrastructure must use an explicit integration command and must not run under `pnpm test`.
- A conformance failure must be fixed in the implementation unless canonical sources conflict.
- Report reproducible fuzz seeds and promote fixed regressions into deterministic tests or canonical vectors as appropriate.

## Verification

Use the narrowest applicable root command, then expand for shared behavior:

```bash
pnpm run test:unit
pnpm run test:integration
pnpm run test:security
pnpm run test:fuzz
pnpm run test:conformance
pnpm run format:check
```

Run `pnpm run verify:cross-language` for protocol-visible behavior and `pnpm run verify` for release-gate or repository-integrity changes.

## Stop Conditions

Stop if a test would redefine canonical behavior, require real credentials/network access in a default suite, mutate canonical data, hide nondeterminism, or depend on ignored/private files.

## Completion Evidence

Report test categories and cases changed, deterministic seeds, expected failure modes, commands and counts, skipped/omitted suites, and whether canonical vectors or public claims changed.

# ALX Protocol Extensions Guide

The root [`AGENTS.md`](../../AGENTS.md) and parent [`protocol/AGENTS.md`](../AGENTS.md) remain applicable. This guide governs `protocol/extensions/`.

## Scope and authority

This directory contains optional profiles and extension protocols. Each extension may define its own manifest, schema, vectors, error registry, and runner. No extension changes what is required for core ALX v1 conformance.

Core authority remains [`../spec.md`](../spec.md), [`../schemas/`](../schemas/), [`../../test-vectors/`](../../test-vectors/), and [`../error-codes.json`](../error-codes.json). An extension's README, manifest, schema, vectors, and error registry jointly govern only implementations claiming that extension.

## Extension invariants

- Every extension is optional and has `requiredForCore: false` in its manifest and suite discovery entry.
- Extension validity must not alter core Block validity, canonicalization, `contentHash`, `blockHash`, parent relationships, Graph outcomes, or Trace behavior.
- Extension data must use a separate envelope or an explicitly permitted content profile; do not add extension fields to the core Block schema.
- Cryptographic extensions require explicit domain separation and must document exact byte encodings, normalization, and verification failure behavior.
- Extension error identifiers remain in the extension's registry and must not masquerade as core error identifiers.
- Lifecycle, version, compatible protocol versions, deprecation, and supersession metadata must be accurate and internally consistent.
- Extension vectors are canonical only for the named extension claim. They must remain deterministic and language-neutral.
- Applications may require an extension by policy, but that requirement must not be described as core ALX conformance.

## Adding or changing an extension

An executable extension should include:

- `extension.json` conforming to [`../schemas/extension-manifest.schema.json`](../schemas/extension-manifest.schema.json);
- a normative README defining scope and exact behavior;
- its own schema and error-code registry when applicable;
- valid, invalid, boundary, and domain-separation vectors;
- a deterministic runner and maintained implementation coverage;
- a discovery entry in [`../suites.json`](../suites.json);
- compatibility and security analysis.

Do not edit expected vectors merely to match one implementation. Resolve the extension authority first, then update every claiming implementation together.

## Current extension checks

From the repository root, use the applicable commands:

```bash
pnpm run test:extension:merkle
pnpm run test:extension:signing
pnpm run verify:suites
pnpm run verify:schemas
pnpm run protocol:checksums:check
pnpm run format:check
```

Run `pnpm run test:extension` when shared extension tooling or discovery changes. Run `pnpm run verify:protocol` to prove that an extension change did not regress core conformance. For cross-language extension implementation changes, run the applicable `test:extension:<name>:ts`, `:python`, and `:rust` commands after building the Rust adapter.

The content-profile extension is schema-only; verify its manifest and schema alignment rather than inventing an executable runner.

## Stop conditions

Stop and request direction if:

- an extension would become necessary to create or validate a core Block;
- an extension would change core identity or reuse a core cryptographic domain ambiguously;
- extension behavior conflicts across its README, schema, vectors, or implementations;
- a lifecycle or compatibility change lacks governance authority;
- cryptographic behavior lacks deterministic vectors or independent implementation coverage;
- required secrets, live networks, or deployed contracts would be needed for default conformance.

## Completion evidence

In addition to the root completion report, state the extension, lifecycle/version impact, affected schemas/vectors/error codes, implementations tested, core-regression result, and any cryptographic or compatibility risk.

## Related sources

- [`README.md`](README.md)
- [`../../EXTENSIONS.md`](../../EXTENSIONS.md)
- [`../../docs/governance/evolution-and-graph-completeness.md`](../../docs/governance/evolution-and-graph-completeness.md)

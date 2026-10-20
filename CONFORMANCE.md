# Conformance

Status: public conformance entry point

ALX conformance is determined from the canonical specification, schemas,
required suite membership, language-neutral vectors, and applicable extension
manifests. Reference implementations provide interoperability evidence but do
not define protocol behavior.

## Canonical conformance materials

| Source | Role |
|---|---|
| [`protocol/spec.md`](./protocol/spec.md) | Normative processing requirements |
| [`protocol/schemas/`](./protocol/schemas/) | Canonical structures and constraints |
| [`protocol/suites.json`](./protocol/suites.json) | Required core suite discovery and comparison modes |
| [`test-vectors/`](./test-vectors/) | Portable inputs, exact outputs, semantic assertions, and failures |
| [`protocol/error-codes.json`](./protocol/error-codes.json) | Exact core error identifiers |
| [`conformance/`](./conformance/) | Shared runners and verification gates |

## Claim boundary

Core conformance and optional-extension conformance are separate claims. An
implementation must satisfy every applicable required suite for the claim it
makes. Passing selected unit tests, using an official SDK, or being published
by an ALX contributor does not independently establish conformance.

Exact-output suites compare complete structured results. Semantic suites apply
the assertions declared by the canonical suite. Raw serialized-input fixtures
remain distinct from decoded ALX-value vectors.

## Repository commands

```bash
pnpm run test:conformance
pnpm run verify:protocol
pnpm run verify:cross-language
pnpm run verify
```

Root [`package.json`](./package.json) scripts are authoritative if command
names change.

## Related documents

- [`conformance/README.md`](./conformance/README.md) — adapter and runner usage
- [`docs/implementers/conformance.md`](./docs/implementers/conformance.md) — explanatory implementer guidance
- [`reference-implementations/PARITY.md`](./reference-implementations/PARITY.md) — maintained implementation coverage

# ALX Canonical Protocol Sources Guide

The root [`AGENTS.md`](../AGENTS.md) remains applicable. This guide governs `protocol/`, except where a more specific nested guide applies.

## Scope and authority

`protocol/spec.md`, `protocol/schemas/`, canonical vector data selected through `protocol/suites.json`, and `protocol/error-codes.json` jointly define ALX behavior. No one file should be edited as a standalone substitute for the others.

`protocol/fixtures/` provides schema and tooling evidence. `protocol/extensions/` defines optional claims. Retrieval OpenAPI and chain configuration describe integration surfaces, not core validity.

## Canonical invariants

- Preserve the five-field v1 Block and fixed v1 identity domains.
- Preserve the ALX value model, exact UTF-8 canonical output, UTF-16 key ordering, number rules, Unicode rejection, depth limit, and raw-ingress boundary.
- Validate parent collections fail-closed; preserve deterministic normalization and the parent limit.
- Keep Block validation separate from `validateGraph(seed, source, context)`.
- Preserve reachable-only source lookup, duplicate candidate diagnosis, context scope, deterministic ordering/counts, and status precedence.
- Treat absence as availability, not invalidity.
- Preserve exact arbitrary-precision Trace `pathCount` behavior.
- Keep optional extensions and application infrastructure outside core Block identity and core conformance.
- Never reuse one hash domain merely because encodings have the same shape.

## Change rules

- Classify edits as editorial, additive, restrictive, or reinterpretive.
- Restrictive/reinterpretive v1 edits require governance and compatibility review.
- A behavioral change updates prose, schemas, errors, vectors, suite metadata/checksums, maintained implementations, and relevant security/versioning documentation together.
- Add valid, invalid, boundary, interaction, precedence, and ordering cases as appropriate.
- Do not alter expected output to accommodate an implementation defect.
- Preserve public schema `$id` values and published artifact paths unless a version/redirect decision authorizes change.
- Keep generated checksums deterministic and review their complete diff.

## Verification

From the repository root:

```bash
pnpm run verify:suites
pnpm run verify:schemas
pnpm run verify:fixtures
pnpm run protocol:checksums:check
pnpm run test:conformance
pnpm run verify:cross-language
pnpm run format:check
```

Run `pnpm run verify:protocol` for every canonical behavioral change and `pnpm run verify` for a release-facing change. Run the applicable extension gates when extension discovery or artifacts change.

Use checksum/signing/site `--write` commands only when regeneration is explicitly in scope; inspect and re-run the corresponding `--check` command afterward.

## Stop conditions

Stop when canonical sources conflict, compatibility classification is unclear, an existing public identifier would change meaning, implementation parity cannot be achieved, an optional feature would become core, or a future-version design is being inferred without canonical authority.

## Completion evidence

Report affected canonical artifacts and sections, compatibility class, vectors and implementations exercised, checksum changes, exact conformance results, protocol-version impact, and unresolved cross-language or security risk.

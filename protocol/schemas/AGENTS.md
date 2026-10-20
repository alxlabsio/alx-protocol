# ALX Protocol Schemas Guide

The root [`AGENTS.md`](../../AGENTS.md) and parent [`protocol/AGENTS.md`](../AGENTS.md) remain applicable. This guide governs `protocol/schemas/`.

## Scope and authority

These JSON Schema Draft 2020-12 documents are canonical protocol sources. They define machine-readable shapes and structural constraints; prose semantics and operation behavior remain governed by [`../spec.md`](../spec.md), canonical vectors, and [`../error-codes.json`](../error-codes.json).

A schema change is protocol-visible even when no implementation code changes.

## Schema invariants

- Use JSON Schema Draft 2020-12 consistently.
- Preserve the public `$id` prefix `https://alxprotocol.com/protocol/1/schemas/` for ALX v1 schemas.
- Treat an existing published `$id` as immutable. A breaking reinterpretation requires a versioned schema and protocol decision.
- Resolve shared definitions through [`defs.schema.json`](defs.schema.json); do not copy constraints into divergent local definitions.
- Keep required fields, closed-object behavior, hash formats, limits, and protocol-version constraints aligned with the specification.
- Do not use a schema to add semantic behavior absent from the specification or vectors.
- Core Blocks remain closed to extension fields. Optional extension envelopes use their own schemas and validity rules.
- Schema references must resolve from a clean repository snapshot without private files or network-dependent discovery.
- Examples and fixtures must not be used as a substitute for explicit schema constraints.

## Compatibility rules

Classify every edit before changing a schema:

- **Editorial:** title, description, or non-behavioral annotation only.
- **Additive:** admits a value or adds a new independently versioned schema without invalidating existing conforming values.
- **Restrictive:** rejects a value previously accepted.
- **Reinterpretive:** preserves shape but changes a field's meaning.

Restrictive and reinterpretive edits are breaking unless they correct a demonstrable mismatch in the jointly authoritative v1 sources through the governance process. Adding a required field is restrictive. Removing `additionalProperties: false` is an expansion and requires the same compatibility review.

## Change coupling

- Update specification prose, fixtures, canonical vectors, expected-result schemas, and implementations together when the protocol shape changes.
- Add both valid and invalid fixtures for each new boundary or conditional rule.
- Update [`../suites.json`](../suites.json) and checksums when a manifest-selected artifact changes.
- Keep schema URLs in manifests, vector files, OpenAPI documents, and documentation aligned.
- Do not run checksum or site write commands unless the task explicitly includes regenerating reviewed derived files.

## Verification

Run from the repository root:

```bash
pnpm run verify:schemas
pnpm run verify:fixtures
pnpm run verify:suites
pnpm run protocol:checksums:check
pnpm run format:check
```

For any behavioral schema change, also run:

```bash
pnpm run verify:protocol
pnpm run verify:cross-language
```

Use `pnpm run protocol:checksums:write` only when canonical artifact regeneration is authorized, then inspect and verify the complete diff.

## Stop conditions

Stop and request direction if:

- schema and specification requirements conflict;
- the compatibility classification is unclear;
- an existing public `$id` would need new meaning;
- a schema change would make an optional extension part of core validity;
- generated checksum or site output changes unexpectedly;
- a required negative or cross-language case cannot be represented consistently.

## Completion evidence

In addition to the root completion report, identify the compatibility classification, affected `$id` values, fixtures and vectors updated, and whether checksums or generated publication artifacts changed.

## Related sources

- [`../spec.md`](../spec.md)
- [`../error-codes.json`](../error-codes.json)
- [`../suites.json`](../suites.json)
- [`../../test-vectors/`](../../test-vectors/)

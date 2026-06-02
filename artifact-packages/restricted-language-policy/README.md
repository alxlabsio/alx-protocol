# Restricted Language Policy

**Status:** informative
**Audience:** Reviewers, integrators
**Authority:** non-normative reference example

## Purpose

The reference example documents portable language constraints as a root Block. The policy Block stores banned terms, replacements, and claim rules for reuse during public-response generation.

## Scope

Root Block structure, verification outcome, and `package verify` command for committed files in the directory.

## Non-Goals

Protocol behavior remains defined in [`protocol/spec.md`](../../protocol/spec.md). The document is non-normative.

## Package Verification Outcome

The policy Block is a root Block with zero parents.

Integrators compose the policy Block with user and brand context Blocks before generating publishable output Blocks.

## Verifying This Package

```bash
node cli/bin/alx.js package verify artifact-packages/restricted-language-policy --json
```

Expected result: `ok: true`, `complete: true`, zero parents, one root Block in the trace.

## Related Documents

- [`../README.md`](../README.md) — full package catalog
- [`../policy-constrained-agent-response/README.md`](../policy-constrained-agent-response/README.md) — derived response with language constraints

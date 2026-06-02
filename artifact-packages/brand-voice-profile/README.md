# Brand Voice Profile

**Status:** informative
**Audience:** Reviewers, integrators
**Authority:** non-normative reference example

## Purpose

The reference example documents portable brand context as a root Block. The profile Block stores preferred terminology, restricted terms, and voice rules for reuse as parent context.

## Scope

Root Block structure, verification outcome, and `package verify` command for committed files in the directory.

## Non-Goals

Protocol behavior remains defined in [`protocol/spec.md`](../../protocol/spec.md). The document is non-normative.

## Package Verification Outcome

The profile Block is a root Block with zero parents.

Integrators reference the profile Block as parent context across multiple derived output Blocks.

## Verifying This Package

```bash
node cli/bin/alx.js package verify artifact-packages/brand-voice-profile --json
```

Expected result: `ok: true`, `complete: true`, zero parents, one root Block in the trace.

## Related Documents

- [`../README.md`](../README.md) — full package catalog
- [`../context-aware-agent-response/README.md`](../context-aware-agent-response/README.md) — derived response example

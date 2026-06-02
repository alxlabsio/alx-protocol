# Agent User Preference Profile

**Status:** informative
**Audience:** Reviewers, integrators
**Authority:** non-normative reference example

## Purpose

The reference example documents durable user preference context as a root Block. The profile Block stores communication and accessibility preferences for reuse as parent context in derived packages.

## Scope

Root Block structure, verification outcome, and `package verify` command for committed files in the directory.

## Non-Goals

Protocol behavior remains defined in [`protocol/spec.md`](../../protocol/spec.md). The document is non-normative.

## Package Verification Outcome

The profile Block is a root Block with zero parents.

Integrators reference the profile Block as a parent of derived response or interface-state Blocks in packages such as `adaptive-security-response` and `adaptive-interface-state`.

## Verifying This Package

```bash
node cli/bin/alx.js package verify artifact-packages/agent-user-preference-profile --json
```

Expected result: `ok: true`, `complete: true`, zero parents, one root Block in the trace.

## Related Documents

- [`../README.md`](../README.md) — full package catalog
- [`../adaptive-interface-state/README.md`](../adaptive-interface-state/README.md) — derived interface state example

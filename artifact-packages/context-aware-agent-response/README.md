# Context-Aware Agent Response

**Status:** informative
**Audience:** Reviewers, integrators
**Authority:** non-normative reference example

## Purpose

The reference example documents explicit context lineage for a generated response Block. The response Block lists a user preference profile Block, a brand voice profile Block, and a task request Block in `parentHashes`.

## Scope

Lineage graph, verification outcome, and `package verify` command for committed files in the directory.

## Non-Goals

Protocol behavior remains defined in [`protocol/spec.md`](../../protocol/spec.md). The document is non-normative.

## Visual Lineage

```mermaid
flowchart LR
  A["User Preference Profile"] --> E["Context-Aware Agent Response"]
  B["Brand Voice Profile"] --> E
  D["Task Request"] --> E
```

## Package Verification Outcome

The response Block binds to three parent Blocks.

A reviewer inspects preference, brand, and task context Blocks from the Trace.

## Verifying This Package

```bash
node cli/bin/alx.js package verify artifact-packages/context-aware-agent-response --json
```

Expected result: `ok: true`, `complete: true`, three parent Blocks in the trace.

## Related Documents

- [`../README.md`](../README.md) — full package catalog
- [`../../docs/integrators/agent-integration.md`](../../docs/integrators/agent-integration.md) — agent integration guide

# Settlement Pattern

Settlement remains outside ALX Protocol core validity.

Settlement can be modeled as an optional product or application-layer extension for systems that need economic coordination around verified artifacts. The [ALX Protocol Whitepaper](./whitepaper.md#part-vii--ecosystem-coordination) describes optional ecosystem services including economic coordination (XAN); economic rules are defined in the XAN Economic Whitepaper and remain outside ALX Protocol core validity.

## Purpose

This document describes one possible product pattern for using ALX Trace output in economic coordination systems.

The protocol core creates no payouts, enforces no payment rules, executes no transfers, defines no royalty formulas, and requires no tokens.

## Scope

ALX Protocol can provide deterministic inputs for application-level settlement systems:

- Block identity;
- parent-bound lineage;
- Trace output;
- `pathCount` values;
- verification receipts.

Applications decide whether those inputs matter economically.

## Non-Goals

This document does not define:

- Block validity;
- protocol conformance;
- payout policy;
- token behavior;
- smart contract requirements;
- registry requirements;
- legal attribution.

## Optional Product Flow

```text
Blocks created      -> verifiable artifacts with lineage
Trace generated     -> structural lineage view
Weights calculated  -> application-specific allocation model
Receipt produced    -> product-level settlement record
Transfer executed   -> external payment or ledger system
```

Each step after Trace generation is application-level behavior.

## Example Pattern

A product can calculate weights from Trace output:

```ts
import { traceAttribution } from "@alx-protocol/sdk";

const trace = traceAttribution(rootBlockHash, graph);
const totalPaths = trace.nodes.reduce((sum, node) => sum + node.pathCount, 0);

const allocations = trace.nodes.map((node) => ({
  blockHash: node.hash,
  pathCount: node.pathCount,
  weight: node.pathCount / totalPaths,
}));
```

The formula above is a product convention. The formula carries no protocol validity.

## Optional Receipt Block

A product can create a Block that records a settlement calculation:

```ts
import { createBlock } from "@alx-protocol/sdk";

const settlementRecord = createBlock(
  {
    type: "settlement.record",
    traceRoot: rootBlockHash,
    formula: "proportional-path-count",
    allocations,
  },
  [rootBlockHash]
);
```

The settlement record is a normal Block. The settlement record leaves the settled Block's identity unchanged.

## Boundary Rule

Settlement systems may use ALX outputs. Settlement systems MUST NOT be required for:

- Block creation;
- Block identity;
- lineage validation;
- local verification;
- protocol conformance.

## Related Documents

- [`../whitepaper.md`](../whitepaper.md) — Part VII optional ecosystem services and economic coordination (XAN)
- [`../verification-receipts.md`](../verification-receipts.md)
- [`../integrators/artifact-package-manifest.md`](./artifact-package-manifest.md)
- [`../../protocol/spec.md`](../../protocol/spec.md)

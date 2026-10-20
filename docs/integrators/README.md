# Integrator Documentation

**Document type:** Guide

These guides help applications use maintained ALX packages and optional integrations. They do not define protocol behavior; canonical authority is mapped in [`../../SPECIFICATION.md`](../../SPECIFICATION.md).

## Essential path

1. [`typescript-sdk-quick-start.md`](./typescript-sdk-quick-start.md) — install the SDK and create, validate, and store Blocks.
2. [`api-reference.md`](./api-reference.md) — maintained TypeScript export map.
3. [`troubleshooting.md`](./troubleshooting.md) — diagnose canonicalization, identity, Graph, Trace, SDK, and CLI failures.
4. [`faq.md`](./faq.md) — common protocol/application boundary questions.

## Workflow guides

- [`attributed-outputs.md`](./attributed-outputs.md) — Block and Trace workflow.
- [`agent-integration.md`](./agent-integration.md) — framework-neutral agent application pattern.
- [`ai-conventions.md`](./ai-conventions.md) — optional application content conventions.
- [`provider-client-adapters.md`](./provider-client-adapters.md) — optional SDK middleware integration.

## Infrastructure guides

- [`block-storage-adapters.md`](./block-storage-adapters.md) — current storage and extension surfaces.
- [`storage.md`](./storage.md) — persistence and retrieval boundaries.
- [`database-guide.md`](./database-guide.md) — application database schema and index patterns.
- [`deployment-checklist.md`](./deployment-checklist.md) — application production controls.
- [`performance.md`](./performance.md) — operation cost and local optimization guidance.
- [`on-chain-base.md`](./on-chain-base.md) — planned optional Base anchoring integration.

## Optional policy and extension patterns

- [`extensions.md`](./extensions.md) — how optional extension/application layers preserve core identity.
- [`application-settlement-boundaries.md`](./application-settlement-boundaries.md) — one explicitly non-protocol economic coordination example.
- [`integration-boundaries.md`](./integration-boundaries.md) — fit and boundary comparison with adjacent systems.

Storage, databases, children/descendants, indexes, Explorers, settlement, provider middleware, and deployment policy remain outside ALX Core.

## Related documents

- [`../../protocol/spec.md`](../../protocol/spec.md) — normative prose
- [`../../sdk/README.md`](../../sdk/README.md) — TypeScript package overview
- [`../../adapters/README.md`](../../adapters/README.md) — storage adapter package

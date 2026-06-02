# Integrator Documentation

The index maps integrator guides. Integrator guides remain outside the protocol specification.

---

For developers connecting ALX Protocol to storage systems, agent frameworks, attestation layers, or settlement infrastructure.

**Authority:** These documents describe application-level patterns. The protocol core remains minimal; integrations extend at the edges.

## Getting Started

- [`attributed-outputs.md`](./attributed-outputs.md) - The attribution workflow: root blocks, parent blocks, output blocks, trace
- [`quickstart.md`](./quickstart.md) - Working integration walkthrough
- [`api-reference.md`](./api-reference.md) - Every exported function, type, and constant
- [`faq.md`](./faq.md) - Common questions answered
- [`troubleshooting.md`](./troubleshooting.md) - Error diagnosis and fixes

## Integration Guides

- [`adapters.md`](./adapters.md) - Shipped adapters: agents, content-addressed storage, MCP, EAS, Solana
- [`storage.md`](./storage.md) - Storage independence with code examples (content-addressed storage, Postgres, filesystem)
- [`extensions.md`](./extensions.md) - Storage adapter, content schema, settlement, workflow patterns
- [`settlement.md`](./settlement.md) - Attribution -> economic coordination flow
- [`agent-integration.md`](./agent-integration.md) - How AI agents produce and consume Blocks
- [`agent-frameworks.md`](./agent-frameworks.md) - LangChain, CrewAI, AutoGen integration examples
- [`workflows.md`](./workflows.md) - Real-world workflows: research pipeline, compliance audit, multi-vendor marketplace
- [`ai-conventions.md`](./ai-conventions.md) - AI-specific conventions: model cards, hallucination grounding, content types
- [`database-guide.md`](./database-guide.md) - Database schema design, indices, and queries

## Production

- [`deployment-checklist.md`](./deployment-checklist.md) - Production readiness checklist
- [`performance.md`](./performance.md) - Operation costs, benchmarks, and optimization patterns
- [`comparison.md`](./comparison.md) - Integration boundaries and fit criteria

# Documentation

This page maps the ALX documentation system. Use the tables below to find the right documents for your role or goal. Full documentation is available at [docs.xandrlabs.ai](https://docs.xandrlabs.ai).

---

## Start Here

| What you want to do | Read this |
|---------------------|-----------|
| Install and make the first Block | [`quickstart.md`](./integrators/quickstart.md) |
| Verify a Block | [`quickstart.md`](./integrators/quickstart.md) — Block validation and artifact package verification |
| Use the SDK | [`api-reference.md`](./integrators/api-reference.md) |
| Understand the Block structure | [`BLOCK.md`](../protocol/BLOCK.md) |
| Deep dive: protocol rules | [`spec.md`](../protocol/spec.md) |

---

## Documentation By Role

Use the table below to find the smallest document set for each role. Only `protocol/` is mandatory for conformance; everything under `docs/` is explanatory.

| Role | Required | Optional (when relevant) | Safe to skip |
|------|----------|--------------------------|--------------|
| **New implementer** (new language port) | [`protocol/spec.md`](../protocol/spec.md), [`protocol/test-vectors/`](../protocol/test-vectors/), [`protocol/suites.json`](../protocol/suites.json), [`implementers/independent-implementation.md`](./implementers/independent-implementation.md), [`implementers/conformance.md`](./implementers/conformance.md), [`data-model.md`](./data-model.md), [`operations.md`](./operations.md), [`implementers/errors.md`](./implementers/errors.md), [`conformance/`](../conformance/) | [`implementers/implementer-guide.md`](./implementers/implementer-guide.md), [`deep-dives/`](./deep-dives/), [`decisions/`](./decisions/) | All of [`integrators/`](./integrators/), [`whitepaper.md`](./whitepaper.md), [`governance/`](./governance/), [`settlement.md`](./integrators/settlement.md), [`workflows.md`](./integrators/workflows.md), agent docs |
| **SDK integrator** (application using `@alx-protocol/sdk`) | [`integrators/quickstart.md`](./integrators/quickstart.md), [`integrators/api-reference.md`](./integrators/api-reference.md), [`integrators/faq.md`](./integrators/faq.md), [`integrators/troubleshooting.md`](./integrators/troubleshooting.md) | [`integrators/storage.md`](./integrators/storage.md), [`integrators/database-guide.md`](./integrators/database-guide.md), [`integrators/deployment-checklist.md`](./integrators/deployment-checklist.md), [`integrators/performance.md`](./integrators/performance.md), [`integrators/extensions.md`](./integrators/extensions.md) | [`implementers/implementer-guide.md`](./implementers/implementer-guide.md), [`decisions/`](./decisions/), [`governance/`](./governance/), [`whitepaper.md`](./whitepaper.md) |
| **Reviewer / auditor** | [Minimum Reviewer Path](#minimum-reviewer-path) below | [`architecture.md`](./architecture.md), [`trust-model.md`](./trust-model.md) | Integrator cookbooks, [`settlement.md`](./integrators/settlement.md), agent framework guides |
| **Adoption evaluator** | [`whitepaper.md`](./whitepaper.md), [`trust-model.md`](./trust-model.md), [`integrators/comparison.md`](./integrators/comparison.md), [`implementers/conformance.md`](./implementers/conformance.md) | [`implementers/compatibility.md`](./implementers/compatibility.md), artifact packages | Implementer build guides, [`database-guide.md`](./integrators/database-guide.md) |
| **Maintainer / contributor** | [`CONTRIBUTING.md`](../CONTRIBUTING.md), [`GOVERNANCE.md`](../GOVERNANCE.md), [`governance/governance.md`](./governance/governance.md) | [`governance/versioning.md`](./governance/versioning.md), [`governance/security.md`](./governance/security.md) | — |

---

## Source Of Authority

The canonical protocol is defined by:

1. `protocol/spec.md`
2. `protocol/schemas/`
3. `protocol/test-vectors/`

Documents in `docs/` explain, organize, or apply the protocol. Companion documents MUST NOT introduce protocol behavior absent from the canonical sources. When a companion document contradicts the specification, the specification wins.

---

## Minimum Reviewer Path

1. README
2. [`../protocol/README.md`](../protocol/README.md)
3. [`../protocol/spec.md`](../protocol/spec.md)
4. [`implementers/conformance.md`](./implementers/conformance.md)
5. [`../reference-implementations/PARITY.md`](../reference-implementations/PARITY.md)
6. [`verification-receipts.md`](./verification-receipts.md)
7. [`integrators/artifact-package-manifest.md`](./integrators/artifact-package-manifest.md)
8. [`../artifact-packages/START-HERE.md`](../artifact-packages/START-HERE.md)

This path gives reviewers the shortest complete view of ALX Protocol, implementation status, verification flow, and public readiness.

---

## Documentation Paths

### Application Integration Path

The application integration path starts with the fastest working setup, then expands into API usage, troubleshooting, and production integration guidance.

1. [`integrators/quickstart.md`](./integrators/quickstart.md) - build a working ALX integration from setup through first verified Block
2. [`integrators/api-reference.md`](./integrators/api-reference.md) - SDK reference for creating, validating, tracing, and verifying Blocks in applications
3. [`integrators/faq.md`](./integrators/faq.md) - answers for common product, integration, and protocol-boundary questions
4. [`integrators/troubleshooting.md`](./integrators/troubleshooting.md) - practical fixes for validation, hashing, lineage, SDK, and integration issues

### ALX Protocol Understanding Path

The protocol understanding path covers what problem ALX solves, what guarantees the protocol provides, where trust boundaries are, and when Blocks are the right primitive for a system.

1. [`../README.md`](../README.md) - public entry point: quickstart, documentation links, and examples
2. [`../protocol/BLOCK.md`](../protocol/BLOCK.md) - Block primitive, identity model, and lineage role
3. [`architecture.md`](./architecture.md) - protocol layers, product boundaries, and design principles
4. [`trust-model.md`](./trust-model.md) - verification guarantees, application responsibilities, and trust boundaries

### Independent Implementation Path

Use this path to build an ALX-compatible implementation in a new language. Implementers follow normative rules, data-model structure, conformance requirements, and stable error behavior required for cross-language compatibility.

1. [`implementers/independent-implementation.md`](./implementers/independent-implementation.md) - standalone checklist: required files, required operations, conformance command
2. [`../protocol/spec.md`](../protocol/spec.md) - normative rules for Block identity, canonicalization, lineage, and verification
3. [`data-model.md`](./data-model.md) - Block fields, hash formats, `parentHashes`, constraints, and validation expectations
4. [`operations.md`](./operations.md) - operation reference for hashing, validation, verification, tracing, and integration behavior
5. [`implementers/implementer-guide.md`](./implementers/implementer-guide.md) - implementation path from scratch, including Go walkthrough
6. [`implementers/conformance.md`](./implementers/conformance.md) - compatibility requirements, test vectors, and conformance expectations
7. [`implementers/errors.md`](./implementers/errors.md) - error codes, failure categories, and recovery guidance

### Storage And Extension Integration Path

Use this path to integrate ALX with storage systems, AI agents, databases, artifact packages, settlement flows, and product-specific adapters while preserving the protocol boundary between core Block validity and optional infrastructure.

1. [`integrators/adapters.md`](./integrators/adapters.md) - adapter boundaries for package verification, storage, signing, and external systems
2. [`integrators/storage.md`](./integrators/storage.md) - storage-independent patterns for persisting and retrieving ALX artifacts
   - [`integrators/glossary.md`](./integrators/glossary.md) - informative terms: blockchain, blockset, vs normative Block/Graph
   - [`integrators/index-blocks.md`](./integrators/index-blocks.md) - off-chain `alx.index` platform approval / inclusion
   - [`integrators/registry-blocks.md`](./integrators/registry-blocks.md) - optional `alx.registry` catalog Blocks for products and platforms
   - [`integrators/on-chain-base.md`](./integrators/on-chain-base.md) - optional ALX anchor on Base (ALXAnchor)
3. [`integrators/extensions.md`](./integrators/extensions.md) - optional extension patterns that preserve core Block identity
4. [`integrators/settlement.md`](./integrators/settlement.md) - settlement concepts for product and marketplace workflows around ALX Blocks
5. [`integrators/agent-integration.md`](./integrators/agent-integration.md) - patterns for agents that create, consume, cite, and verify Blocks
6. [`integrators/agent-frameworks.md`](./integrators/agent-frameworks.md) - examples for LangChain, CrewAI, AutoGen, and similar agent frameworks
7. [`integrators/workflows.md`](./integrators/workflows.md) - product workflow examples for research, compliance, marketplaces, and artifact review
8. [`integrators/database-guide.md`](./integrators/database-guide.md) - database schemas, indexes, and queries for ALX-backed applications
9. [`integrators/deployment-checklist.md`](./integrators/deployment-checklist.md) - production checks for deploying ALX integrations safely

### Adoption Evaluation Path

Use this path to assess ALX for adoption, integration planning, or technical evaluation.

1. [`whitepaper.md`](./whitepaper.md) - problem framing, protocol design, adoption path, optional ecosystem services (indexing, open-world lineage, XAN), and ecosystem architecture for evaluators and investors
2. [`integrators/comparison.md`](./integrators/comparison.md) - integration boundaries and fit criteria
3. [`implementers/compatibility.md`](./implementers/compatibility.md) - cross-impl parity matrix
4. [`trust-model.md`](./trust-model.md) - verification guarantees and trust boundaries
5. [`implementers/conformance.md`](./implementers/conformance.md) - conformance requirements

### Governance And Contribution Path

The governance and contribution path covers how ALX changes are proposed, reviewed, versioned, secured, and governed. Intended for contributors, maintainers, reviewers, and ecosystem partners evaluating long-term protocol stewardship.

1. [`../CONTRIBUTING.md`](../CONTRIBUTING.md) - contribution rules
2. [`../GOVERNANCE.md`](../GOVERNANCE.md) - stewardship model and conformance as governance
3. [`governance/governance.md`](./governance/governance.md) - RFC process
4. [`governance/versioning.md`](./governance/versioning.md) - version policy
5. [`governance/security.md`](./governance/security.md) - threat model

---

## Document Reference

### Public Documentation Map

| Document | Audience | Authority | Purpose | Public-v1 |
|---|---|---|---|---|
| [`../README.md`](../README.md) | New readers, reviewers, builders | Non-normative | Minimal entry point: npm quickstart, docs links, and examples | Yes |
| [`whitepaper.md`](./whitepaper.md) | Evaluators, integrators, investors | Non-normative | Problem framing, protocol design, adoption path, optional ecosystem services, and ecosystem architecture | Yes |
| [`../protocol/README.md`](../protocol/README.md) | Protocol implementers, technical reviewers | Normative index | Maps the normative protocol artifacts, schemas, vectors, and implementation requirements | Yes |
| [`../protocol/spec.md`](../protocol/spec.md) | Independent implementers, protocol reviewers | Normative | Defines Block validity, canonicalization, lineage, identity, and required protocol behavior | Yes |
| [`implementers/conformance.md`](./implementers/conformance.md) | Implementation authors, test authors | Normative companion | Defines what an implementation must prove to be ALX-compatible | Yes |
| [`../reference-implementations/PARITY.md`](../reference-implementations/PARITY.md) | Implementers, maintainers, reviewers | Non-normative | Tracks capability parity across TypeScript, Python, and Rust reference implementations | Yes |
| [`verification-receipts.md`](./verification-receipts.md) | Integrators, auditors | Non-normative | Explains how verification receipts capture reproducible evidence without changing core Block identity | Yes |
| [`integrators/artifact-package-manifest.md`](./integrators/artifact-package-manifest.md) | Integrators, package authors | Non-normative | Defines how artifact packages organize ALX-related files while staying outside core protocol validity | Yes |
| [`../artifact-packages/START-HERE.md`](../artifact-packages/START-HERE.md) | Reviewers, adoption evaluators | Non-normative | Provides the shortest guided path through canonical artifact package examples | Yes |
| [`integrators/settlement.md`](./integrators/settlement.md) | Product teams, ecosystem partners | Non-normative | Describes optional economic coordination patterns that can build on ALX without becoming core validity rules | No |
| [`integrators/adapters.md`](./integrators/adapters.md) | Integrators, infrastructure teams | Non-normative | Explains how ALX connects to storage, signing, packages, and external systems through optional adapters | No |

### Essential Top-Level Documents

| Document | Audience | Purpose |
|---|---|---|
| [`architecture.md`](./architecture.md) | New technical readers, product architects, reviewers | Explains the ALX layer model, design principles, and how core protocol boundaries relate to optional product infrastructure |
| [`trust-model.md`](./trust-model.md) | Integrators, security reviewers, adoption evaluators | Clarifies what ALX verifies, what it leaves to external systems, and how trust boundaries are preserved |
| [`data-model.md`](./data-model.md) | Implementers, SDK authors, schema reviewers | Defines every major field, type, constraint, and structural rule used by ALX-compatible Blocks |
| [`operations.md`](./operations.md) | Implementers, SDK authors, conformance testers | Classifies the protocol operations and explains how each operation relates to validation, verification, or integration behavior |

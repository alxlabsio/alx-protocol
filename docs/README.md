# ALX Documentation

**Document type:** Guide

This page is the map for public ALX documentation. Everything under `docs/` is explanatory; canonical authority is defined in [`../SPECIFICATION.md`](../SPECIFICATION.md).

## Start here

| Goal | Document |
|---|---|
| Understand the repository and create a first Block | [`../README.md`](../README.md) |
| Navigate canonical protocol sources | [`../SPECIFICATION.md`](../SPECIFICATION.md) |
| Read the complete normative prose | [`../protocol/spec.md`](../protocol/spec.md) |
| Follow the maintained SDK walkthrough | [`quick-start.md`](./quick-start.md) |
| Build an independent implementation | [`implementation-guide.md`](./implementation-guide.md) |
| Review security and trust boundaries | [`threat-model.md`](./threat-model.md) |

## Core explanatory references

| Document | Distinct responsibility |
|---|---|
| [`architecture.md`](./architecture.md) | Protocol layers, authority, and application boundaries |
| [`data-model.md`](./data-model.md) | Map from named structures to canonical schemas and prose |
| [`operations.md`](./operations.md) | Classification of canonical operations, SDK helpers, extensions, and application utilities |
| [`trust-model.md`](./trust-model.md) | What local verification establishes and excludes |
| [`verification-receipts.md`](./verification-receipts.md) | Optional record of one verification run |

Focused root references provide shorter entry points for [`canonicalization`](../CANONICALIZATION.md), [`identity`](../IDENTITY.md), [`Graph and Trace`](../GRAPH.md), [`conformance`](../CONFORMANCE.md), [`extensions`](../EXTENSIONS.md), and [`terminology`](../GLOSSARY.md).

## Implementers

Start with [`implementers/README.md`](./implementers/README.md).

| Document | Purpose |
|---|---|
| [`implementers/independent-implementation-checklist.md`](./implementers/independent-implementation-checklist.md) | Required implementation and conformance checklist |
| [`implementers/language-implementation-guide.md`](./implementers/language-implementation-guide.md) | Language-port walkthrough and implementation pitfalls |
| [`implementers/conformance.md`](./implementers/conformance.md) | Suite, runner, adapter, and claim model |
| [`implementers/protocol-errors-and-diagnostics.md`](./implementers/protocol-errors-and-diagnostics.md) | Canonical error identifiers and layer-specific handling |
| [`implementers/implementation-compatibility-matrix.md`](./implementers/implementation-compatibility-matrix.md) | Maintained implementation capability and parity matrix |

## Integrators

Start with [`integrators/README.md`](./integrators/README.md).

The essential path is the [`TypeScript SDK quick start`](./integrators/typescript-sdk-quick-start.md), [`SDK API reference`](./integrators/api-reference.md), and [`troubleshooting`](./integrators/troubleshooting.md). Storage, databases, agents, providers, deployment, performance, optional extensions, and anchoring guides describe application choices and must not be read as core protocol requirements.

## Decisions and governance

- [`decisions/README.md`](./decisions/README.md) indexes durable architecture decisions and historical rationale. ADRs do not override current canonical sources.
- [`governance/README.md`](./governance/README.md) indexes RFC, versioning, compatibility, migration, stability, and security-review material.
- Repository-wide contribution and stewardship rules live in [`../CONTRIBUTING.md`](../CONTRIBUTING.md), [`../GOVERNANCE.md`](../GOVERNANCE.md), and [`../MAINTAINERS.md`](../MAINTAINERS.md).

## Public/internal and protocol/application boundaries

Point-in-time audits, local handoffs, active security working records, maintainer tooling, and migration TODOs are internal records and are excluded from the public documentation set.

XNDR indexer, Explorer, and application-backend architecture belongs in the standalone XNDR application repository. Generic integration guidance may explain how an application builds on ALX, but ALX Core is not a database, indexer, crawler, hosted service, global Graph, or Explorer.

## Authority

ALX behavior is governed collectively by:

1. [`../protocol/spec.md`](../protocol/spec.md);
2. [`../protocol/schemas/`](../protocol/schemas/);
3. [`../test-vectors/`](../test-vectors/); and
4. [`../protocol/error-codes.json`](../protocol/error-codes.json).

[`../protocol/suites.json`](../protocol/suites.json) defines required suite discovery. When a guide conflicts with canonical sources, repair the guide.

## Publication

Publication authority, organizational roles, domains, and release status are recorded in [`../PUBLICATION.md`](../PUBLICATION.md). Repository-relative links remain the authoritative public navigation until a documentation domain is activated under that policy.

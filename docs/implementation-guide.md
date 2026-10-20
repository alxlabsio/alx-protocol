# Implementation Guide

This is the stable documentation entry point for implementing ALX Protocol in
an additional language.

Use these maintained sources in order:

1. [`../SPECIFICATION.md`](../SPECIFICATION.md) — canonical-source and topic map;
2. [`../protocol/spec.md`](../protocol/spec.md) — complete normative prose;
3. [`implementers/independent-implementation-checklist.md`](./implementers/independent-implementation-checklist.md)
   — minimum independent implementation checklist;
4. [`implementers/language-implementation-guide.md`](./implementers/language-implementation-guide.md)
   — detailed implementation walkthrough;
5. [`../CONFORMANCE.md`](../CONFORMANCE.md) — conformance claim and runner model;
6. [`../test-vectors/`](../test-vectors/) — canonical portable cases.

This page avoids creating a second maintained copy of the detailed implementer
guide.

## Authority

Implementation and reference-code behavior remains subordinate to canonical
protocol sources. When implementation behavior conflicts with the canonical
specification, schemas, vectors, or error registry, the canonical sources
govern.

## Related documents

- [`architecture.md`](./architecture.md)
- [`data-model.md`](./data-model.md)
- [`operations.md`](./operations.md)
- [`implementers/protocol-errors-and-diagnostics.md`](./implementers/protocol-errors-and-diagnostics.md)

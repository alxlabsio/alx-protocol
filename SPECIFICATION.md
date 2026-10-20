# ALX Protocol Specification Map

Status: public entry point to the canonical ALX Protocol v1 sources

The complete normative prose specification remains
[`protocol/spec.md`](./protocol/spec.md). This page organizes the protocol by
concern without copying requirements into a second source of truth.

## Canonical authority

ALX Protocol behavior is governed collectively by:

1. [`protocol/spec.md`](./protocol/spec.md) — normative processing rules,
   invariants, and protocol semantics;
2. [`protocol/schemas/`](./protocol/schemas/) — canonical structures and
   constraints;
3. [`test-vectors/`](./test-vectors/) — language-neutral conformance inputs,
   expected outputs, and failure cases; and
4. [`protocol/error-codes.json`](./protocol/error-codes.json) — canonical core
   error identifiers.

[`protocol/suites.json`](./protocol/suites.json) defines required suite
membership, and [`protocol/VERSION`](./protocol/VERSION) declares the protocol
version.

## Topic map

| Concern | Start here | Primary canonical source |
|---|---|---|
| Canonicalization | [`CANONICALIZATION.md`](./CANONICALIZATION.md) | [`protocol/spec.md`, section 2](./protocol/spec.md#2-canonicalization) |
| Block and content identity | [`IDENTITY.md`](./IDENTITY.md) | [`protocol/spec.md`, sections 1 and 3](./protocol/spec.md#1-primitive) |
| Parent relationships, Graph, and Trace | [`GRAPH.md`](./GRAPH.md) | [`protocol/spec.md`, sections 4 and 5](./protocol/spec.md#4-lineage) |
| Conformance | [`CONFORMANCE.md`](./CONFORMANCE.md) | [`protocol/suites.json`](./protocol/suites.json) and [`test-vectors/`](./test-vectors/) |
| Security boundary | [`SECURITY.md`](./SECURITY.md) | [`protocol/spec.md`, sections 8 and 9](./protocol/spec.md#8-boundaries) |
| Version compatibility | [`VERSIONING.md`](./VERSIONING.md) | [`protocol/VERSION`](./protocol/VERSION) and the versioning policy |
| Optional extensions | [`EXTENSIONS.md`](./EXTENSIONS.md) | [`protocol/extensions/`](./protocol/extensions/) |
| Terminology | [`GLOSSARY.md`](./GLOSSARY.md) | [`protocol/spec.md`, Terminology](./protocol/spec.md#terminology) |

## Core boundary

`Block` is the sole protocol primitive. Core identity is determined from
`content` and normalized `parentHashes`. Storage, transport, indexing,
discovery, application metadata, reverse child indexes, signatures, proofs,
and blockchain anchoring remain outside core Block identity.

Applications may build those capabilities around ALX while preserving the
canonical Block and verification rules.

## Implementer path

1. Read [`protocol/spec.md`](./protocol/spec.md).
2. Implement the applicable structures in
   [`protocol/schemas/`](./protocol/schemas/).
3. Execute the suites discovered through
   [`protocol/suites.json`](./protocol/suites.json).
4. Compare complete normative results against [`test-vectors/`](./test-vectors/).
5. Use [`CONFORMANCE.md`](./CONFORMANCE.md) for the claim and runner model.

## Related documents

- [`protocol/README.md`](./protocol/README.md) — canonical artifact hierarchy
- [`docs/architecture.md`](./docs/architecture.md) — explanatory architecture
- [`docs/implementation-guide.md`](./docs/implementation-guide.md) — implementer route
- [`PUBLICATION.md`](./PUBLICATION.md) — publication authority and lifecycle

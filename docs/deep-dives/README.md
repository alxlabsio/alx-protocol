# Protocol Companion Deep Dives

The directory contains companion documents that explain the ALX Protocol model in greater detail. These documents help implementers, reviewers, and product teams understand how deterministic identity, canonicalization, lineage, invariants, and core protocol guarantees work across implementations.

The protocol specification remains the primary source of normative behavior. Companion deep dives clarify design intent, implementation expectations, edge cases, and verification reasoning for readers who need more detail than the main specification provides.

---

## Authority

These documents elaborate on [`protocol/spec.md`](../../protocol/spec.md). The documents preserve the same protocol model and help readers understand how to implement, review, and integrate ALX Protocol correctly.

When a deep dive and the protocol specification appear to differ, [`protocol/spec.md`](../../protocol/spec.md) is authoritative.

## Documents

| Document | Audience | Purpose |
|---|---|---|
| [`canonical-envelope.md`](./canonical-envelope.md) | Implementers, SDK authors, conformance reviewers | Explains deterministic serialization, canonical byte output, hash derivation, and identity-sensitive encoding rules |
| [`lineage.md`](./lineage.md) | Implementers, graph-tool authors, product engineers | Explains parent-bound lineage, acyclic Graph validation, parent normalization, and structural derivation behavior |
| [`invariants.md`](./invariants.md) | Implementers, maintainers, test authors | Defines the semantic guarantees that ALX-compatible implementations preserve across identity, lineage, immutability, attribution, and determinism |
| [`core-contract.md`](./core-contract.md) | Technical reviewers, architecture reviewers, product teams | Summarizes the ALX core contract: stable identity, verifiable lineage, deterministic operations, and protocol boundaries |

## Companion Document Usage

The deep dives support the following tasks:

- implement ALX Protocol in a new language
- review protocol behavior before adoption
- understand how Block identity is derived
- validate lineage and graph behavior
- map tests to protocol invariants
- explain ALX Protocol boundaries to product, security, or ecosystem reviewers

## Reading Order

For the shortest path through the protocol model:

1. [`core-contract.md`](./core-contract.md)
2. [`canonical-envelope.md`](./canonical-envelope.md)
3. [`lineage.md`](./lineage.md)
4. [`invariants.md`](./invariants.md)

The order starts with the ALX Protocol guarantee surface, then moves into identity derivation, graph structure, and invariant enforcement.

---

## Related Documents

- [`../data-model.md`](../data-model.md) — Block and Trace field reference
- [`../operations.md`](../operations.md) — operation signatures referenced by deep dives
- [`../implementers/conformance.md`](../implementers/conformance.md) — conformance requirements for implementations
- [`../../protocol/spec.md`](../../protocol/spec.md) — normative protocol behavior

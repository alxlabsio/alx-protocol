# Architecture

ALX Protocol layered architecture. Protocol behavior remains defined by [`../protocol/spec.md`](../protocol/spec.md).

---

## Purpose

Describes the layered architecture of ALX Protocol: rationale for layer ordering, how the layers compose, and how the repository maps to the architecture.

---

ALX Protocol is structured in four deterministic layers. Each layer depends only on the layers below the current layer.

---

## Layered Architecture Rationale

AI agents need verification infrastructure that works across languages, systems, and organizations without shared state. The following requirements apply:

- **Determinism** - identical inputs must produce identical outputs regardless of implementation language, so that verification remains independent of a specific runtime
- **Layered composition** - each capability (canonicalization, hashing, validation, tracing) must be independently implementable and testable, so that partial implementations are still useful
- **Content opacity** - the protocol excludes inspection and constraint of agent-produced payloads, so that any JSON-compatible output can become a verifiable Block
- **Storage independence** - verification must work regardless of where artifacts are stored, so that the protocol avoids infrastructure lock-in

The four-layer architecture below satisfies the requirements above.

---

## Layer Diagram

```text
Layer 4: Trace
  traceAttribution(root, graph)
  -> nodes, edges, depths, pathCounts, leaves

Layer 3: Validation
  validateGraph, verifyGraph, buildGraph
  -> Graph integrity and content authenticity

Layer 2: Hash and Block
  deriveBlockHash, deriveContentHash
  createBlock, validateBlock
  -> deterministic Block identity

Layer 1: Canonicalization
  canonicalize(value)
  -> deterministic UTF-8 bytes
```

**Signing** (EIP-712) is orthogonal - Signing can be applied at any layer without affecting block identity.

---

## Repository Structure

```text
alx-protocol/
  protocol/                    Canonical protocol files
    spec.md                    Normative specification
    schemas/                   JSON Schema definitions
    fixtures/                  Valid and invalid examples
    test-vectors/              Conformance vectors
    extensions/                Optional extension specs

  reference-implementations/   TypeScript, Python, and Rust implementations
  conformance/                 Cross-implementation suite runner and repo verification gates
    bin/                         verify-* gates, differential-core-check
  cli/                         Developer verification tooling
    lib/                         Artifact package validator (alx package verify)
  artifact-packages/           Canonical artifact packages
  docs/                        Explanatory documentation
```

Maintainer-only regen scripts may live locally under `scripts/` (gitignored); regen scripts remain optional for conformance and `alx package verify`.

The repository structure keeps protocol truth, implementation code, examples, and explanatory documentation separate.

---

## Design Principles

1. **Determinism** - Same input produces same output, always, in any language
2. **Content opacity** - The protocol excludes inspection of `content`
3. **Storage independence** - Blocks are verified by hash, independent of storage location
4. **Layered composition** - Each layer builds on the previous; no circular dependencies
5. **Orthogonal signing** - Signatures attest to blocks without affecting block identity

The principles above make ALX suitable as shared verification infrastructure: any agent system that implements the protocol produces artifacts that any other system can verify, without coordination.

---

## Canonical Versus Reference Surfaces

| Component | Authority | Can differ across implementations- |
|---|---|---|
| `protocol/spec.md` | **Canonical** - the protocol | No |
| `protocol/test-vectors/` | **Canonical** - required outputs | No |
| `protocol/schemas/` | **Canonical** - structural constraints | No |
| `reference-implementations/*` | **Reference** - one correct way | Implementation details may vary |
| `cli/` | **Tooling** - convenience | Outside conformance requirements |
| `artifact-packages/` | **Examples** - complete package artifacts | Non-normative |
| `protocol/extensions/` | **Extensions** - optional capabilities | Core conformance excludes extension requirements |

---

## Conformance Boundary

An implementation is **conformant** if the implementation produces byte-identical outputs for the canonical test vectors. Specifically:

- Canonicalization: same input string -> same canonical output
- Block identity: same content + same parents -> same blockHash and contentHash
- Attribution: same root + same graph -> same trace (nodes, edges, depths, pathCounts)

Everything else (CLI, HTTP API, storage, signing) is outside the conformance boundary.

---

## Optional Ecosystem Layers

Services above the protocol layer—hosted indexing, external parent references in open-world validation mode, and economic coordination (XAN)—are optional and remain outside influence on Block validity or conformance. See [Part VII — Ecosystem Coordination](./whitepaper.md#part-vii--ecosystem-coordination) in the whitepaper and the [Settlement pattern](./integrators/settlement.md) for product-level patterns.

---

## Related Documents

- [`whitepaper.md`](./whitepaper.md) — Part VII optional ecosystem services
- [`trust-model.md`](./trust-model.md) — verification boundaries complementary to the conformance boundary above
- [`protocol/spec.md`](../protocol/spec.md) — normative protocol behavior
- [`implementers/conformance.md`](./implementers/conformance.md) — conformance requirements

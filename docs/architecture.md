# Protocol Architecture

This document describes the ALX Protocol architecture. Normative behavior is defined by [`protocol/spec.md`](../protocol/spec.md), [`protocol/schemas/`](../protocol/schemas/), [`test-vectors/`](../test-vectors/), and the applicable error registry.

## Authority Model

| Source | Role |
|---|---|
| [`protocol/spec.md`](../protocol/spec.md) | Processing rules, protocol semantics, and invariants |
| [`protocol/schemas/`](../protocol/schemas/) | Structural requirements |
| [`test-vectors/`](../test-vectors/) | Required outputs, rejection cases, and boundaries |
| [`protocol/error-codes.json`](../protocol/error-codes.json) | Exact core protocol error identifiers |
| [`protocol/extensions/*/error-codes.json`](../protocol/extensions/) | Exact extension error identifiers |
| [`protocol/suites.json`](../protocol/suites.json) | Operational conformance-suite discovery |
| [`protocol/VERSION`](../protocol/VERSION) | Current protocol version declaration |

The specification, schemas, and vectors collectively define canonical behavior. Error registries define exact identifiers. Suite and extension manifests support discovery and do not define Block validity.

## Core Processing Architecture

ALX Protocol uses four deterministic processing layers. Each layer consumes outputs or concepts defined by the layers below it.

```text
Layer 4  Trace
         traceAttribution(root, graph, context)
         -> nodes, edges, depths, pathCount, leaves

Layer 3  Lineage and Graph verification
         buildGraph, validateGraph, verifyGraph
         -> resolved relationships, integrity results, missing or external parents

Layer 2  Block identity
         deriveContentHash, deriveBlockHash, createBlock, validateBlock
         -> contentHash, blockHash, normalized parentHashes

Layer 1  Canonicalization
         canonicalize(value)
         -> deterministic UTF-8 JSON bytes
```

### Layer 1: Canonicalization

Canonicalization converts an accepted JSON value into deterministic UTF-8 bytes. It defines object-key ordering, array preservation, number serialization, string handling, rejected values, and the recursion-depth boundary.

Canonical rules are defined in [`spec.md`, section 2](../protocol/spec.md#2-canonicalization). Executable cases are discovered through the canonicalization suites in [`suites.json`](../protocol/suites.json).

### Layer 2: Block Identity

A Block binds opaque `content` and normalized direct parent identities.

```text
contentHash = keccak256(UTF8("ALX-CONTENT-V1\0") || canonicalize(content))
blockHash   = keccak256(UTF8("ALX-BLOCK-V1\0") || canonicalize({ content, parentHashes }))
```

The core Block fields are:

```json
{
  "blockHash": "0x...",
  "contentHash": "0x...",
  "parentHashes": [],
  "content": {},
  "protocolVersion": "1"
}
```

`protocolVersion` is required for version 1 data and remains outside hash derivation. Identity rules are defined in [`spec.md`, section 1](../protocol/spec.md#1-primitive) and [`spec.md`, section 3](../protocol/spec.md#3-identity).

### Layer 3: Lineage and Graph Verification

`parentHashes` declares direct parent Block identities. Parent order is removed by normalization before Block identity is derived.

Graph verification evaluates Block integrity, parent resolution, duplicate identities, cycles, and verification context. It does not infer relationships from time, storage order, file paths, or application metadata.

Lineage rules and verification modes are defined in [`spec.md`, section 4](../protocol/spec.md#4-lineage).

### Layer 4: Trace

Trace derives attribution structure from a root Block and a Graph. Its output includes reachable nodes, directed edges, minimum and maximum depths, leaf identities, and `pathCount`.

An AttributionTrace is a computed protocol result. It is not a Block, identity-bearing object, storage primitive, or paginated query response. Services use separate application envelopes for bounded traversal, pagination, index scope, and truncation.

Trace does not interpret the meaning, quality, ownership, or value of Block content. Trace rules are defined in [`spec.md`, section 5](../protocol/spec.md#5-attribution).

## Verification Modes

| Mode | Parent availability |
|---|---|
| Closed-world | Every declared parent resolves to an available Block in the verification context |
| Open-world | Unavailable parents are accepted only when the verification context explicitly declares them external |

Closed-world verification is the protocol default. Open-world results prove that an external parent hash is bound into the child identity; they do not prove the external Block's existence, validity, or ancestry.

## Core Boundary

The deterministic core includes:

- canonicalization;
- parent normalization;
- content and Block hash derivation;
- Block validation;
- Graph construction and validation;
- closed-world and explicit open-world verification;
- Trace computation.

The following surfaces remain outside core Block identity:

| Surface | Role |
|---|---|
| Content Envelope profile | Optional structure for application content |
| Signing and attestations | Actor claims over an existing Block identity |
| Merkle proofs | Inclusion proofs over `blockHash` values |
| Local storage and retrieval | Persistence and availability |
| IPFS and S3 adapters | External storage transport |
| Verification receipts | Application records of verification runs |
| Contracts and anchoring | Optional publication of existing hashes |
| CLI and HTTP servers | Imperative interfaces over SDK behavior |

Optional data does not enter `blockHash` derivation. Extension support is reported separately from core conformance.

## Dependency Direction

```text
Trace
  -> Lineage and Graph verification
       -> Block identity
            -> Canonicalization
```

Core dependencies flow toward lower layers. Time, network access, storage, credentials, and chain state enter through adapters or command shells.

## Repository Map

| Path | Responsibility |
|---|---|
| [`protocol/`](../protocol/) | Canonical sources, fixtures, suite discovery, extensions, and chain configuration |
| [`sdk/`](../sdk/) | Primary TypeScript implementation |
| [`reference-implementations/`](../reference-implementations/) | Python and Rust implementations |
| [`conformance/`](../conformance/) | Cross-implementation runners and repository verification gates |
| [`adapters/`](../adapters/) | Optional storage and external-system adapters |
| [`cli/`](../cli/) | Block commands, local storage, retrieval, HTTP services, and command routing |
| [`contracts/`](../contracts/) | Optional anchoring contracts |
| [`docs/`](./) | Explanatory and integration documentation |

The CLI, servers, adapters, contracts, documentation, and independently maintained application indexers consume canonical behavior. They do not define additional Block validity rules.

## Conformance Boundary

Core conformance is suite-specific. Implementations replay every required core suite listed in [`protocol/suites.json`](../protocol/suites.json).

Comparison modes include:

- exact canonical byte output;
- semantic acceptance or rejection;
- exact `contentHash` and `blockHash` values;
- exact lineage and Trace structures;
- boundary and invalid-input outcomes.

Optional extension conformance is evaluated through the extension suites listed separately in `suites.json`.

## Related Documents

- [`protocol/README.md`](../protocol/README.md) — canonical-source index
- [`protocol/spec.md`](../protocol/spec.md) — normative protocol behavior
- [`implementers/conformance.md`](./implementers/conformance.md) — conformance requirements
- [`trust-model.md`](./trust-model.md) — verification guarantees and external responsibilities
- [`../cli/README.md`](../cli/README.md) — available CLI commands

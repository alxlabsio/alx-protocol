# Protocol Evolution and Graph Completeness

**Document type:** Reference

This document explains accepted evolution boundaries for ALX v1. It does not define future protocol behavior; a future version requires its own canonical specification, schemas, vectors, and migration decision.

## Frozen v1 foundations

- A v1 Block has `blockHash`, `contentHash`, `parentHashes`, `content`, and `protocolVersion: "1"`.
- `protocolVersion` selects v1 interpretation but is excluded from both v1 hash preimages.
- V1 identity uses the fixed domain-separated Keccak-256 rules.
- Storage, availability, transport, indexing, discovery, and reverse relationships remain outside the Block.
- Optional extensions remain independently versioned and are not required for core conformance.

A change to canonicalization, hash preimages, domain tags, Block validity, Graph status meanings, or existing canonical expected results is breaking and requires a new protocol version unless it repairs a formally governed inconsistency in unreleased material.

## Completeness is context-dependent

Graph verification always describes the supplied seed, Block source, and Verification Context.

| Outcome | Meaning |
|---|---|
| `valid` | Every check required by the context completed without a violation. |
| `invalid` | At least one definite protocol violation was discovered. |
| `incomplete` | No violation was found, but required syntactically valid Block data was unavailable. |
| `resource_limit_reached` | No violation was found, but processing stopped because an execution budget was exhausted. |

Precedence is `invalid > resource_limit_reached > incomplete > valid`. Absence alone is not a protocol violation.

Closed-world mode is the default and requires every reachable in-scope parent. Open-world mode excludes only explicitly declared external parents from required resolution. An undeclared missing parent remains required.

`maxDepth` is an intentional claim boundary. Resource limits are execution budgets. Neither permits a result to imply verification outside the recorded context.

## Version boundaries

Every v1 Block declares `protocolVersion: "1"`. A v1 verifier rejects unsupported versions rather than guessing another version's rules.

If a future protocol version permits cross-version parent references, its canonical sources must define:

- which version's rules apply to each examined Block;
- how the verification request carries or resolves that information;
- whether cross-version Graph verification is supported;
- how unsupported versions affect request acceptance and checked results; and
- how identity domains prevent reinterpretation of existing v1 hashes.

V1 documentation must not promise that an unspecified v2 Block can reference or validate against v1 material. `parentHashes` text alone is insufficient to define future cross-version semantics.

## Resource limits

The canonicalization depth and parent-count limits are protocol rules. Implementations and services may enforce additional documented byte, source-lookup, time, memory, output, cryptographic-work, or concurrency budgets.

Local budgets must not:

- broaden a `valid` claim;
- turn unavailable data into a violation;
- return a partial object as a conformant Block or Attribution Trace; or
- assign a core invalidity identifier without an independent protocol violation.

## Extension lifecycle

Each extension manifest declares its own version, lifecycle, compatible protocol versions, deprecation state, and supersession relationship. Current extension discovery begins at [`../../protocol/suites.json`](../../protocol/suites.json).

The allowed lifecycle values and exact manifest shape are defined by [`../../protocol/schemas/extension-manifest.schema.json`](../../protocol/schemas/extension-manifest.schema.json). A lifecycle change does not change core conformance.

## Application evolution

Applications can version content schemas, indexes, API envelopes, databases, and Explorer models independently. Application evolution must preserve canonical Blocks and must not describe derived children, observation metadata, or query completeness as new Block fields or protocol guarantees.

## Related documents

- [`versioning.md`](./versioning.md) — protocol and package version policy
- [`migration.md`](./migration.md) — current upgrade guidance
- [`stability.md`](./stability.md) — lifecycle terminology
- [`../decisions/011-graph-validation-outcomes.md`](../decisions/011-graph-validation-outcomes.md) — outcome decision record
- [`../../protocol/spec.md`](../../protocol/spec.md) — canonical v1 behavior

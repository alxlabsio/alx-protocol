---
---

# Blocks

The document explains the purpose of the Block primitive. For the normative specification, see `[spec.md](./spec.md)`.

---

## The Problem

AI systems produce artifacts — prompts, responses, tool calls, decisions, summaries, embeddings, retrieval results. Artifacts produced by AI systems are:

- **Ephemeral** — lost after the session ends
- **Unverifiable** — no way to prove what inputs produced what outputs
- **Unattributable** — no way to trace which sources contributed to a result
- **Non-composable** — locked inside the system that created

AI outputs cannot be audited, reused, credited, or independently verified without verification infrastructure.

Without verification infrastructure, AI-generated artifacts cannot participate in economies, audit trails, or cross-system workflows.

---

## The Primitive

The Block primitive gives each artifact:

- **Deterministic identity** — blockHash derived from canonicalized content and parentHashes
- **Immutability** — once created, a Block cannot change without changing its identity
- **Composability** — Blocks reference parent Blocks, forming a directed acyclic graph
- **Verifiability** — any implementation can recompute the hash and confirm integrity
- **Attributability** — the graph structure determines who contributed what

```
Block = { blockHash, contentHash, parentHashes, content }
```

ALX Protocol never inspects `content`. ALX Protocol guarantees that identity, lineage, and attribution are deterministic.

---

## Blocks vs Storage

Blocks are a verification format.

| Concern                 | Block's Role                                                                                         |
| ----------------------- | ---------------------------------------------------------------------------------------------------- |
| Where is the data?      | Outside the Block's scope — use a content-addressed storage system, a database, or any storage layer |
| Is the data authentic?  | Recompute the hash and compare                                                                       |
| What produced the data? | Follow `parentHashes` to trace lineage                                                               |
| Who contributed?        | Run `traceAttribution` on the graph                                                                  |

A Block can be stored anywhere, transmitted over any channel, and verified by any implementation — without trusting the storage or transport layer.

---

## Verification Without Trust

Block verification requires only mathematics. A verifier recomputes the hash from content and parents and compares the result to the stored blockHash:

```
"The artifact is authentic because the hash matches the content and parents."
```

No external authority is required. No shared infrastructure is required. Any implementation in any language can independently verify a Block.

---

## Attribution as Structure

ALX Protocol resolves attribution as a structural property. Policy decisions remain at the application layer. `traceAttribution` computes `pathCount`, depth, and reachability from the Graph:

```
"The Block is reachable through three distinct paths from the root."
```

No policy engine is required. Applications can map structural properties to weights, payments, or credit. The structure is deterministic and auditable.

---

## Block Capabilities

| Use Case                     | How Blocks Help                                                         |
| ---------------------------- | ----------------------------------------------------------------------- |
| **AI agent pipelines**       | Declared parent relationships form a verifiable Graph                   |
| **Audit trails**             | Trace any output back to its original inputs through lineage            |
| **Multi-agent coordination** | Agents share state via Blocks without shared infrastructure             |
| **Content attribution**      | Trace reports structural `pathCount` values through the Graph           |
| **Reproducible research**    | The same content and parents produce the same `blockHash`                |

---

## The Insight

Blocks are small. ALX Protocol is minimal. Composition produces the capability.

A Block binds content and `parentHashes` into deterministic identity. Multiple Blocks form a Graph through declared parent relationships. Trace derives structural attribution data from that Graph.

ALX Protocol defines verification infrastructure. Applications build storage, interfaces, and coordination layers around the protocol invariants.

ALX Protocol provides deterministic attribution structure through `pathCount`, depth, and reachability. Applications decide what that structure means economically. See [`docs/integrators/settlement.md`](../docs/integrators/settlement.md).

## Related Documents

- [Protocol specification](./spec.md)
- [Block schema](./schemas/block.schema.json)
- [Canonical test vectors](./test-vectors/README.md)

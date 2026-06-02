# ALX Protocol Specification

---

**ALX Protocol defines structure. Meaning resides at the application layer. ALX Protocol encodes how blocks relate. The interpretation of those relationships is outside the protocol scope.**

A deterministic protocol for representing, validating, and traversing compositional structure, where identity is derived from content and lineage, and attribution is resolved as structure rather than policy.

> The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHOULD", "SHOULD NOT", "MAY", and "OPTIONAL" in this document are to be interpreted as described in [RFC 2119](https://www.ietf.org/rfc/rfc2119.txt).

---

## Normative Scope

This document is the single source of truth for all core protocol rules. The test vectors in `protocol/test-vectors/` are normative for core conformance (implementations MUST produce identical outputs for identical inputs).

The spec is the ultimate authority. Implementations defer to the spec. If a reference implementation contradicts this specification, the specification takes precedence. Conformance is determined by producing byte-identical outputs for the canonical test vectors, regardless of implementation language.

Documents in `docs/` elaborate on concepts defined here but MUST NOT introduce new requirements. If a companion document contradicts this specification, this specification takes precedence.

---

## Terminology

| Term | Definition |
|---|---|
| **Block** | The ALX Protocol primitive — artifact content and parent lineage bound into a deterministic blockHash. |
| **blockHash** | Keccak-256 hash of the canonical form of `{ content, parentHashes }`. The unique identity of a block. |
| **contentHash** | Keccak-256 hash of the canonical form of `content` alone. |
| **parentHashes** | An unordered set of parent Block hashes, bound into blockHash. |
| **content** | Any JSON-serializable value. Opaque to the protocol. |
| **canonicalization** | Deterministic JSON serialization producing identical output for identical input. |
| **lineage** | The directed acyclic graph (DAG) formed by block parent references. |
| **attribution** | The structural computation of contribution through the lineage graph. |
| **pathCount** | The number of distinct paths from a root block to a given node in the DAG. |
| **conformant** | An implementation that produces byte-identical outputs for the canonical test vectors. |
| **normalization** | The process of lowercasing, deduplicating, sorting, and filtering parent hashes. |
| **attestation** | An EIP-712 signature over a block hash. Orthogonal to block identity. |

---

## 1. Primitive

A **Block** binds artifact content and parent lineage into a single deterministic blockHash.

```
Block = { blockHash, contentHash, parentHashes, content }
```

| Field | Type | Description |
|---|---|---|
| `blockHash` | `0x`-prefixed 64-char lowercase hex | `keccak256(canonicalize({ content, parentHashes }))` |
| `contentHash` | `0x`-prefixed 64-char lowercase hex | `keccak256(canonicalize(content))` |
| `parentHashes` | sorted array of `0x`-prefixed hashes | unordered set of parent Block hashes |
| `content` | any JSON-serializable value | opaque to the protocol |
| `protocolVersion` | string, optional | identifies the hash and canonicalization algorithm; excluded from hash derivation; MUST be `"1"` in v1; absent MUST be treated as `"1"` |

### Invariants

1. Same content + same parentHashes = same blockHash (deterministic)
2. Hashes are irreversible (keccak-256)
3. parentHashes MUST be normalized, sorted lexicographically, and deduplicated
4. parentHashes are an unordered set of parent Block hashes — implementations MUST normalize parentHashes to sorted lexicographic order for deterministic hashing. Application-level ordering is a content concern.
5. Content is opaque — the protocol never inspects it
6. `null` and `undefined` content are equivalent (both canonicalize to `"null"`)
7. Implementations MUST silently drop invalid parent hashes during normalization
8. Implementations MUST enforce a maximum of 256 parent hashes after normalization
9. `protocolVersion`, if present, MUST equal `"1"`. Implementations MUST reject Blocks declaring an unrecognized `protocolVersion`. If absent, implementations MUST treat the Block as `protocolVersion: "1"`. `protocolVersion` MUST NOT be included in the hash derivation input.

If normalized `parentHashes` contains more than 256 hashes, implementations MUST reject Block creation or hash derivation rather than truncating the set.

---

## 2. Canonicalization

Algorithm: `recursive-json-sort-v1`

### Rules

| Input type | Output |
|---|---|
| `null` | `"null"` |
| `undefined` | `"null"` |
| `true` | `"true"` |
| `false` | `"false"` |
| integer (safe range) | decimal string, no quotes (e.g., `"42"`, `"-1"`) |
| `-0` | `"0"` |
| float | `JSON.stringify(value)` — IEEE 754 shortest representation |
| string | JSON-escaped with double quotes |
| array | `[` + elements in original order + `]` (order-preserving) |
| object | `{` + keys sorted lexicographically + `}`, `undefined` values excluded |
| `BigInt` | **rejected** — MUST be rejected with an error |
| `Symbol` | **rejected** — MUST be rejected with an error |
| `NaN`, `Infinity`, `-Infinity` | **rejected** — MUST be rejected with an error |
| integers outside safe range | **rejected** — MUST be rejected with an error |

### Encoding

All string output is UTF-8. No Unicode normalization is applied — composed and decomposed forms are distinct.

Implementations MUST NOT produce different output for the same input.

### Depth limit

Implementations MUST enforce a maximum recursion depth of 128. Exceeding this depth MUST produce an error.

### Formal grammar (ABNF)

```
canonical-value   = "null" / "true" / "false"
                  / canonical-number / canonical-string
                  / canonical-array / canonical-object

canonical-number  = ["-"] 1*DIGIT ["." 1*DIGIT] ["e" ["-"] 1*DIGIT]

canonical-string  = DQUOTE *(unescaped / escaped) DQUOTE
unescaped         = %x20-21 / %x23-5B / %x5D-10FFFF
escaped           = "\" ( DQUOTE / "\" / "/" / "b" / "f" / "n" / "r" / "t"
                  / "u" 4HEXDIG )

canonical-array   = "[" [ canonical-value *( "," canonical-value ) ] "]"

canonical-object  = "{" [ canonical-pair *( "," canonical-pair ) ] "}"
canonical-pair    = canonical-string ":" canonical-value
```

Keys in `canonical-object` MUST be sorted by UTF-16 code-unit comparison. No whitespace between tokens.

### Cross-language implementation notes

- Integers: decimal string, no leading zeros, no `+` sign
- Floats: IEEE 754 shortest representation matching JavaScript's `JSON.stringify()`. Examples: `0.5` → `"0.5"`, `1e-7` → `"1e-7"` (incorrect: `"1e-07"` or `"0.0000001"`)
- `-0`: MUST produce `"0"`
- `undefined` in arrays: MUST produce `"null"`
- `undefined` in object values: MUST be excluded
- Key sort: UTF-16 code-unit comparison (locale-independent). For ASCII keys (U+0000 to U+007F), this is identical to byte-order sorting.

---

## 3. Identity

```
blockHash   = keccak256(canonicalize({ content, parentHashes }))
contentHash = keccak256(canonicalize(content))
```

The hash input for `blockHash` is always an object with exactly two keys: `content` and `parentHashes`. After canonicalization, key order is:

`"content" < "parentHashes"` (because `c < p`).

So the canonical form is:

```
{"content":<canonicalized content>,"parentHashes":[<sorted hashes>]}
```

### Hash format

All hashes are lowercase `0x`-prefixed 64-character hexadecimal strings (32 bytes).

Pattern: `/^0x[a-f0-9]{64}$/`

Implementations MUST produce identical hashes for identical inputs across all platforms and languages.

### Hash algorithm agility

ALX v1 defines a single hash algorithm: Keccak-256. All `blockHash` and `contentHash` values are 32-byte Keccak-256 digests, hex-encoded with a `0x` prefix.

Future versions of the protocol MAY support additional hash algorithms. To enable hash agility without breaking v1 Block identity, the hash algorithm could be encoded in the hash prefix using a multihash-compatible format (e.g., `0x1b20` = Keccak-256 per multihash convention). v1 implements a single hash algorithm (Keccak-256). Hash agility remains reserved for future protocol versions. The forward compatibility path is recorded here.

Implementations MUST NOT assume the hash algorithm from the hash length alone. When hash agility is introduced, the algorithm MUST be explicitly specified.

---

## 4. Lineage

Blocks reference other blocks via `parentHashes`. This forms a directed acyclic graph (DAG).

### Validation rules

| Rule | Description |
|---|---|
| No cycles | Implementations MUST detect and reject cycles |
| No self-reference | A block MUST NOT appear in its own parentHashes |
| No duplicate parents | Each parent hash MUST appear at most once after normalization |
| Orphan detection | Implementations SHOULD verify that all parent hashes resolve to known blocks when a known set is provided |

### Parent Resolution Semantics

ALX validation distinguishes between **closed-world validation** and **open-world validation**.

#### Closed-World Validation

Closed-world validation is the default validation mode.

In closed-world validation, every parent referenced by a Block MUST be resolvable in the validation context. A Block that references a parent hash for which no corresponding parent Block is available is invalid under closed-world validation.

Closed-world validation is appropriate when a verifier expects to possess the complete derivation Graph required to validate the artifact's declared lineage.

#### Open-World Validation

Open-world validation is valid only when explicitly declared by the verification context.

In open-world validation, a Block MAY reference external parents absent from the local validation context, provided those parent references are explicitly declared as external.

An external parent reference preserves lineage identity without requiring the parent Block to be available during local validation. The verifier can confirm that the child Block declares the external parent hash and that the declared parent hash is bound into the child Block identity, but the verifier cannot validate the external parent's content, structure, or ancestry unless the parent Block is later provided.

#### Required Behavior

A conformant verifier MUST apply closed-world validation by default.

A conformant verifier MUST reject a Block under closed-world validation if any declared parent hash cannot be resolved to a parent Block in the validation context.

A conformant verifier MAY apply open-world validation only when the verification context explicitly declares open-world mode.

A conformant verifier MUST NOT treat missing parent Blocks as valid under open-world validation unless those missing parents are explicitly declared as external.

A conformant verifier MUST reject undeclared missing parents in all validation modes.

A conformant verifier MUST preserve external parent hashes in lineage calculations, Block identity verification, graph traversal outputs, and attribution-related structures.

A conformant verifier MUST distinguish between:

- resolved parents
- declared external parents
- undeclared missing parents

| Parent state | Closed-world validation | Open-world validation |
|---|---:|---:|
| Parent hash is present and resolves to a valid Block | Valid | Valid |
| Parent hash is missing and declared external | Invalid | Valid as unresolved external parent |
| Parent hash is missing and undeclared as external | Invalid | Invalid |
| Parent hash is present but invalid | Invalid | Invalid |
| Parent hash is malformed | Invalid | Invalid |

Open-world validation confirms structural binding only. Open-world validation confirms that the child Block's declared parent hash is structurally bound into the child Block identity, without confirming that an external parent exists, is available, is valid, or carries a known ancestry.

If the external parent Block is later provided, the verifier MAY validate that parent and extend the resolved portion of the derivation Graph.

#### Normative Summary

Closed-world validation is the default.

Open-world validation is opt-in and context-declared.

A missing parent is valid only when all of the following are true:

1. open-world validation is active;
2. the parent hash is declared in the child Block's parent list;
3. the missing parent is explicitly marked as external in the verification context.

All undeclared missing parents are invalid.

### Graph verification

`verifyGraph(blocks, computeHash)` proves authenticity:
1. Each block's hash matches its content (recomputed via `computeHash`)
2. Every parent reference resolves to a block in the set
3. Both conditions must hold for a block to be counted as verified

### Incremental validation

For real-time agent pipelines, implementations MAY provide incremental validation that checks a single new block against an existing validated graph without re-validating the entire graph. The incremental result MUST be equivalent to what `validateGraph` would produce for the combined graph.

If a block arrives before its parents (out-of-order delivery), the incremental validator MUST reject the block as having missing parents. The caller is responsible for buffering out-of-order blocks and re-validating when parents arrive. The validator operates without an orphan queue.

---

## 5. Attribution

`traceAttribution(rootHash, graph)` resolves the full lineage structure from a root block.

### Output: AttributionTrace

```
{
  root: string,
  validationMode: "closed-world" | "open-world",
  complete: boolean,
  nodes: [{ hash, minDepth, maxDepth, pathCount, parentCount, childCount }],
  edges: [{ from, to }],
  leaves: string[],
  missingParents: string[],
  externalParents: string[],
  maxDepth: number,
  cycle: boolean,
  precisionLoss?: boolean
}
```

### Semantics

| Field | Meaning |
|---|---|
| `root` | the block whose lineage was traced |
| `validationMode` | `"closed-world"` or `"open-world"` — inherited from the verification context |
| `complete` | `true` when all parent hashes resolved; `false` when any parent is missing or external |
| `nodes` | all blocks reachable from root through the graph |
| `edges` | direct edges (from child -> to parent) among reachable nodes |
| `leaves` | nodes with no parents (original sources) |
| `missingParents` | parent hashes referenced by reachable blocks but absent from the graph and undeclared as external |
| `externalParents` | parent hashes declared as external boundaries in the verification context |
| `minDepth` | shortest path length from root to the node |
| `maxDepth` | longest path length from root to the node |
| `pathCount` | number of distinct paths from root to the node |
| `parentCount` | number of direct parents the node has |
| `childCount` | number of blocks that reference the node as a parent |
| `precisionLoss` | `true` when path-count accumulation exceeded safe integer precision; absent means no precision loss |

### Algorithm

1. DFS cycle pre-check from root (O(V+E))
2. BFS traversal from root to discover all reachable nodes and edges
3. Topological-order propagation to compute exact path counts

pathCount is exact — computed via topological propagation. DFS visit counting produces approximations and is excluded.

### Invariant

Same root + same graph = same trace, always.

Implementations MUST produce identical traces for identical inputs (same root + same graph = same trace).

Implementations MUST use topological propagation to compute exact path counts.

Attribution traces MAY include `precisionLoss: true` when path-count accumulation exceeds the implementation's safe integer range (e.g., 2^53 for IEEE 754 doubles). Implementations SHOULD detect this condition and flag it rather than silently returning imprecise values.

---

## 6. Merkle Proofs (optional extension)

Implementations MAY provide sorted-pair Merkle tree construction for checkpoint anchoring. Merkle proofs enable off-chain proof of Block inclusion in an on-chain checkpoint root.

Merkle trees are orthogonal to Block identity. Merkle trees operate on arrays of `blockHash` values and use the same keccak-256 hash function. The sorted-pair construction (`hash(min, max)`) ensures canonical tree structure regardless of leaf input order.

Merkle functionality is an OPTIONAL extension. Merkle functionality is NOT part of core protocol conformance and MUST NOT be required to create, verify, exchange, or trace Blocks.

Merkle extension behavior is defined separately in `protocol/extensions/merkle/` and tested by its own extension-conformance suite. The Merkle extension is provided for anchoring adapters and other integrations that need checkpoint inclusion proofs.

---

## 7. Signing (optional extension)

Signing is an OPTIONAL extension orthogonal to block identity. A Block's `blockHash` is always derived from content and parents — never from a signature. Signing adds an authorship attestation: "this signer produced or verified this Block."

Signing is NOT part of core protocol conformance and MUST NOT be required to create, verify, exchange, or trace Blocks.

### Signer / Verifier interfaces

The protocol defines algorithm-agnostic interfaces for signing:

```
Signer {
  getId(): Promise<string>       — signer's public identifier
  sign(data: Uint8Array): Promise<string>  — sign the raw hash bytes
  algorithm: string              — algorithm identifier
}
```

The `data` parameter passed to `sign()` receives the **raw 32-byte binary representation** of the blockHash, decoded from hex before the call. Implementations MUST decode the `0x`-prefixed hex blockHash to its 32-byte binary representation before passing to the signer. All signers sign the same bytes regardless of hex encoding conventions, ensuring cross-language compatibility.

```

Verifier {
  verify(data: Uint8Array, signature: string, expectedSigner?: string): Promise<{ ok: boolean; signer: string }>
  algorithm: string
}
```

Implementations MAY provide built-in signers for common algorithms (e.g., EIP-712, Ed25519). The protocol accepts any signing algorithm.

### BlockAttestation type

```
BlockAttestation {
  blockHash: string    — the block hash being attested
  attester: string     — signer's public identifier
  algorithm: string    — signing algorithm used (e.g., "eip712", "ed25519")
  timestamp: number    — unix seconds (signer-provided)
  signature: string    — signature over blockHash
}
```

Blocks MAY include one or more attestations via the `attestations` array. The legacy singular `attestation` field is accepted for backward compatibility; implementations SHOULD prefer `attestations`. Both fields are OPTIONAL and excluded from the hash envelope — a signed Block and an unsigned Block with the same content and parents have the same `blockHash`.

### Operations

`createSignedBlock(content, parentHashes, signer, timestamp?)` — create a Block and attach an attestation in one step.

`validateSignedBlock(block, verifier)` — verify both hash integrity and attestation signature.

`signBlock(blockHash, opts)` — create a durable EIP-712 attestation. **Deprecated**: use `createSignedBlock()` with an `Eip712Signer` instead. Will be removed in v2.0.

`verifyBlockSignature(attestation, opts)` — verify an EIP-712 attestation. **Deprecated**: use `validateSignedBlock()` with an `Eip712Verifier` instead. Will be removed in v2.0.

Attestations are durable — no expiry, no nonce. Use protocol request signing for ephemeral actions with replay prevention.

### Protocol Request signing

For ephemeral actions with replay prevention, use `verifySignedProtocolPayload` with nonce, expiry, chainId, and domain.

---

## 8. Boundaries

The protocol MUST NOT define or constrain:

- What content means — knowledge, code, documents, anything
- Block types or categories (applications define these)
- Payout policy, payment amounts, distribution curves, or economic incentives
- Storage format (blocks can be stored anywhere — content-addressed storage systems, databases, filesystems, object stores)
- Transport protocol (blocks can be sent over any channel)
- Order of dependencies (parentHashes are an unordered set; order is content-level)

The protocol MUST NOT inspect, validate, or constrain the `content` field beyond JSON serializability.

ALX Protocol provides deterministic attribution structure (pathCounts, depths, reachability). Applications decide what that structure means economically. See [`docs/integrators/settlement.md`](../docs/integrators/settlement.md).

---

## 9. Non-Goals

The following are explicitly outside the protocol's scope. The items listed are permanent architectural exclusions, outside the protocol scope.

| Non-goal | Rationale |
|---|---|
| **Storage** | Block verification depends on hash, independent of storage location. Storage is an infrastructure concern. |
| **Execution** | The protocol defines structure and verification. Computation and side effects reside outside the protocol scope. |
| **Settlement policy** | Attribution structure is deterministic; economic meaning is application-level. |
| **Content validation** | The protocol treats content as opaque. Content schemas are application conventions. |
| **Identity / authentication** | Block identity is deterministic, derived from content and parentHashes. Actor identity is orthogonal (EIP-712 signing). |
| **Ordering / consensus** | parentHashes are an unordered set. Sequencing is a content-level or application-level concern. |
| **Transport** | Blocks can be sent over any channel. Wire format and network protocol remain outside the protocol scope. |

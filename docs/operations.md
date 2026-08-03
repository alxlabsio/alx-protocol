# Operations

ALX operations defined by the specification, schemas, and canonical test vectors. New protocol behavior remains outside the scope of the operations document.

---

## Purpose

Complete reference for core protocol operations plus optional extension operations, classified by layer and conformance requirement.

---

Core operations are defined by ALX Protocol. SDK import utilities and optional extension operations are classified separately. Deterministic operations return identical outputs for identical inputs.

## Summary

| Operation | Layer | Input | Output | Deterministic | Errors |
|---|---|---|---|---|---|
| `canonicalize` | 1 | any JSON value | canonical string | Yes | BigInt, Symbol, NaN, Infinity, depth, unsafe int |
| `deriveBlockHash` | 2 | content + parentHashes | `0x`-prefixed hash | Yes | canonicalization errors |
| `deriveContentHash` | 2 | content | `0x`-prefixed hash | Yes | canonicalization errors |
| `createBlock` | 2 | content + parentHashes | Block object | Yes | canonicalization errors |
| `validateBlock` | 2 | Block object | `{ ok, expected, actual }` | Yes | invalid hash format |
| `normalizeHash` | 2 | string | lowercase hash | Yes | invalid format |
| `normalizeHashes` | 2 | string[] or omitted | sorted unique hashes | Yes | `ALX_INVALID_HASH`; `ALX_TOO_MANY_PARENTS` |
| `sanitizeImportedParentHashes` | SDK import boundary | unknown | normalized subset and diagnostics | Yes | none |
| `validateLineage` | 3 | blockHash + parents + known | LineageResult | Yes | none |
| `validateGraph` | 3 | graph | GraphResult | Yes | none |
| `verifyGraph` | 3 | blocks + hashFn | VerifyResult | Yes | missing computeHash |
| `traceAttribution` | 4 | rootHash + graph | AttributionTrace | Yes | missing root, invalid graph |
| `buildMerkleTree` | Merkle extension | string[] (hashes) | `{ root, layers }` | Yes | empty array |
| `getMerkleProof` | Merkle extension | leaves + leaf | MerkleProof or null | Yes | none |
| `verifyMerkleProof` | Merkle extension | root + leaf + proof | boolean | Yes | none |
| `signBlock` | extension | blockHash + signer | BlockAttestation | No (timestamp) | invalid hash |
| `verifyBlockSignature` | extension | attestation | VerificationResult | Yes | invalid signature |
| `buildReplayScopeKey` | extension | actor + nonce + opts | scope key string | Yes | missing actor/nonce |
| `validateReplayWindow` | extension | payload + opts | ReplayResult | Yes | see codes |
| `buildProtocolSigningDomain` | extension | chainId + contract | EIP712Domain | Yes | invalid chainId |
| `normalizeSignedProtocolPayload` | extension | raw payload | NormalizedPayload | Yes | malformed fields |
| `verifySignedProtocolPayload` | extension | payload + signature | VerificationResult | Yes | see codes |

---

## Layer 1: Canonicalize

### `canonicalize(value): string`

Convert any JSON-compatible value to its canonical string representation.

**Input:** Any JSON-serializable value (null, boolean, number, string, array, object).

**Output:** A deterministic UTF-8 string.

**Constraints:**
- Object keys MUST be sorted lexicographically
- Undefined object values MUST be excluded
- Array order MUST be preserved
- `null` and `undefined` MUST both produce `"null"`
- `-0` MUST produce `"0"`
- Non-finite numbers (NaN, Infinity, -Infinity) MUST be rejected
- BigInt and Symbol MUST be rejected
- Integers outside safe range MUST be rejected
- Recursion depth MUST NOT exceed 128

**Errors:**
- `BigInt not allowed` - input contains BigInt
- `Symbol not allowed` - input contains Symbol
- `Non-finite number not allowed` - input contains NaN, Infinity, or -Infinity
- `Integer out of safe range` - integer exceeds safe range
- `Canonicalization depth exceeded 128` - nesting too deep

**conformance vectors:** `protocol/test-vectors/canonicalization.json` (C1-C13), `canonicalization-negative.json` (CN1-CN6)

---

## Layer 2: Hash

### `deriveBlockHash(content, parentHashes): string`

Compute the deterministic identity of a block from its content and lineage.

**Input:**
| Parameter | Type | Required | Description |
|---|---|---|---|
| `content` | any | Yes | JSON-serializable value. `null` if absent. |
| `parentHashes` | string[] | No | Parent `blockHash` values. Default: `[]` |

**Output:** `0x`-prefixed 64-character lowercase hexadecimal string (keccak-256 hash).

**Computation:**
```
blockHash = keccak256(canonicalize({ content, parentHashes }))
```

Where `parentHashes` normalizes (lowercase, deduplicated, sorted) before canonicalization.

**Constraints:**
- parentHashes MUST be normalized before hashing
- Invalid parent collections or entries MUST reject hash derivation with `ALX_INVALID_HASH`
- `null` and `undefined` content MUST be treated as equivalent

**conformance vectors:** `protocol/test-vectors/block-identity.json` (B1-B7)

---

### `deriveContentHash(content): string`

Compute the hash of content alone (without lineage).

**Input:** Any JSON-serializable value.

**Output:** `0x`-prefixed 64-character lowercase hexadecimal string.

**Computation:**
```
contentHash = keccak256(canonicalize(content))
```

---

### `createBlock(content, parentHashes): Block`

Create a complete block with computed identity.

**Input:**
| Parameter | Type | Required | Description |
|---|---|---|---|
| `content` | any | Yes | JSON-serializable value |
| `parentHashes` | string[] | No | Parent `blockHash` values |

**Output:** Block object:
```json
{
  "blockHash": "0x...",
  "contentHash": "0x...",
  "parentHashes": ["0x...", ...],
  "content": <original content>
}
```

**Constraints:**
- blockHash MUST equal `deriveBlockHash(content, parentHashes)`
- contentHash MUST equal `deriveContentHash(content)`
- parentHashes MUST be normalized (lowercase, deduplicated, sorted)
- content MUST be preserved as-is (null-coalesced)

---

### `validateBlock(block): BlockValidation`

Verify that a block's hash matches its content and parents.

**Input:** Block object with `blockHash`, `content`, and `parentHashes`.

**Output:**
```json
{
  "ok": true|false,
  "expected": "0x...",
  "actual": "0x..."
}
```

**Constraints:**
- MUST recompute `deriveBlockHash(block.content, block.parentHashes)` and compare to `block.blockHash`
- MUST NOT modify the block

---

### `normalizeHash(hash): string`

Normalize a single hash to canonical format.

**Input:** A string.

**Output:** Lowercase `0x`-prefixed 64-character hexadecimal string.

**Errors:**
- `invalid hash` - input remains outside pattern `/^0x[a-f0-9]{64}$/` after lowercasing and trimming

---

### `normalizeHashes(hashes): string[]`

Normalize, deduplicate, and sort an array of hashes.

**Input:** Array of strings.

**Output:** Sorted array of unique lowercase hashes.

**Errors:**
- `ALX_INVALID_HASH` - the supplied value must be an array and every entry must be a valid hash string
- `ALX_TOO_MANY_PARENTS` - normalization produces more than 256 distinct hashes

### `sanitizeImportedParentHashes(hashes): SanitizedParentHashes`

Inspect untrusted parent-hash data before a caller selects an import policy.

**Input:** An unknown value from an import boundary.

**Output:** A sorted unique valid subset plus rejected-entry, duplicate, and collection-overflow diagnostics.

The `ok` field is true when every entry is accepted and the normalized set contains at most 256 distinct hashes. Duplicate-only input remains usable after normalization. Core Block creation calls strict normalization directly.

---

## Layer 3: Validate

### `validateLineage(blockHash, parentHashes, knownHashes?): LineageResult`

Validate a single block's lineage within an optional known set.

**Input:**
| Parameter | Type | Required | Description |
|---|---|---|---|
| `blockHash` | string | Yes | The block being validated |
| `parentHashes` | string[] | Yes | Declared parents of the block |
| `knownHashes` | Set or string[] | No | Hashes known to exist |

**Output:**
```json
{
  "ok": true|false,
  "blockHash": "0x...",
  "parents": ["0x...", ...],
  "duplicates": ["0x...", ...],
  "missing": ["0x...", ...],
  "selfRef": true|false,
  "cycle": true|false
}
```

**Constraints:**
- A block MUST NOT appear in its own parentHashes (selfRef)
- Duplicate parents MUST be detected
- Missing parents SHOULD be reported when knownHashes is present

**conformance vectors:** `protocol/test-vectors/lineage-negative.json` (LN1-LN6)

---

### `validateGraph(graph): GraphResult`

Validate an entire block graph for structural integrity.

**Input:** Map or array of `[blockHash, parentHashes[]]` entries.

**Output:**
```json
{
  "ok": true|false,
  "blocks": <count>,
  "edges": <count>,
  "roots": ["0x...", ...],
  "issues": [<LineageResult>, ...]
}
```

**Constraints:**
- MUST detect cycles via O(V+E) DFS
- MUST detect self-references
- MUST detect duplicate parents

---

### `verifyGraph(blocks, computeHash): VerifyResult`

Verify the authenticity of a chain of blocks by recomputing hashes.

**Input:**
| Parameter | Type | Required | Description |
|---|---|---|---|
| `blocks` | Block[] | Yes | Array of block objects |
| `computeHash` | function | Yes | Hash function to recompute identity |

**Output:**
```json
{
  "ok": true|false,
  "verified": <count>,
  "broken": [{ "blockHash": "0x...", "reason": "hash_mismatch"|"parent_not_found" }]
}
```

---

## Layer 4: Trace

### `traceAttribution(rootHash, graph): AttributionTrace`

Resolve the full lineage structure from a root block through a graph.

**Input:**
| Parameter | Type | Required | Description |
|---|---|---|---|
| `rootHash` | string | Yes | The block whose lineage is being traced |
| `graph` | Map | Yes | blockHash -> parentHashes mapping |

**Output:**
```json
{
  "root": "0x...",
  "nodes": [{ "hash", "minDepth", "maxDepth", "pathCount", "parentCount", "childCount" }],
  "edges": [{ "from", "to" }],
  "leaves": ["0x...", ...],
  "maxDepth": <number>,
  "cycle": true|false
}
```

**Algorithm:**
1. DFS cycle pre-check from root (O(V+E))
2. BFS traversal to discover reachable nodes and edges
3. Topological-order propagation to compute exact path counts

**Constraints:**
- Implementations MUST produce identical traces for identical inputs
- Implementations MUST use exact path count computation via topological propagation; approximation remains excluded
- Nodes MUST be sorted by minDepth, then hash
- Edges MUST be sorted by from, then to
- Leaves MUST be sorted lexicographically
- Cycles MUST be detected and reported; traversal of cycles remains excluded

**conformance vectors:** `protocol/test-vectors/attribution-trace.json` (T1-T6)

---

## Orthogonal: Signing

### `signBlock(blockHash, opts): BlockAttestation`

Create an EIP-712 attestation for a `blockHash`.

**Input:**
| Parameter | Type | Required | Description |
|---|---|---|---|
| `blockHash` | string | Yes | The `blockHash` to attest |
| `opts.signer` | object | Yes | EIP-712 signer |
| `opts.chainId` | number | Yes | EIP-155 chain ID |
| `opts.verifyingContract` | string | No | Contract address. Default: zero address |
| `opts.timestamp` | number | No | Unix timestamp. Default: now |

**Output:**
```json
{
  "blockHash": "0x...",
  "attester": "0x...",
  "timestamp": <number>,
  "signature": "0x..."
}
```

**Constraints:**
- Signing MUST NOT affect blockHash or lineage
- Attestations are durable (no expiry, no nonce)

### `verifyBlockSignature(attestation, opts): VerificationResult`

Verify a block attestation signature.

**Output:**
```json
{
  "ok": true|false,
  "code": "ok"|"invalid_block_hash"|"attester_mismatch"|"invalid_signature",
  "recoveredAttester": "0x..."
}
```

---

## Merkle Extension (Checkpoint Proofs)

The optional extension operations below support off-chain Merkle tree construction for external checkpoint integrations. Merkle operations remain **outside core conformance**. Implementations claiming Merkle extension support MUST match the sorted-pair hashing rule defined by the Merkle extension.

### `buildMerkleTree(leaves): MerkleTree`

Build a Merkle tree from `blockHash` values.

**Input:** `string[]` - array of `0x`-prefixed `blockHash` strings.

**Output:**
```json
{ "root": "0x...", "layers": [["0x...", ...], ...] }
```

**Constraints:**
- Leaves MUST be normalized (lowercase) and sorted before tree construction
- Hash pairs MUST use sorted-pair ordering: `keccak256(concat(min, max))`
- Tree construction MUST match the sorted-pair hash rule defined by the Merkle extension

---

### `getMerkleProof(leaves, leaf): MerkleProof | null`

Generate an inclusion proof for a specific leaf.

**Input:**
| Parameter | Type | Description |
|---|---|---|
| `leaves` | `string[]` | All leaves in the tree |
| `leaf` | `string` | The leaf to prove |

**Output:** `{ proof: string[], root: string, leaf: string, index: number }` or `null` when the leaf is absent from the tree.

---

### `verifyMerkleProof(root, leaf, proof): boolean`

Verify a Merkle inclusion proof.

**Input:**
| Parameter | Type | Description |
|---|---|---|
| `root` | `string` | Expected Merkle root |
| `leaf` | `string` | Leaf to verify |
| `proof` | `string[]` | Sibling hashes |

**Output:** `boolean` - whether the proof is valid.

**Constraints:**
- Empty proof: valid if and only if `leaf == root` (single-block checkpoint)
- Hash pairs: sorted-pair ordering (`min < max` by hex comparison)

---

## Replay Prevention (Extension)

The operations below support replay protection for ephemeral signed requests. Replay storage and policy remain application concerns outside core conformance.

### `buildReplayScopeKey(opts): string`

Build a unique replay key.

**Input:** `{ actor: string, nonce: string, chainId?: number | null, domain?: string | null }`

**Output:** Null-byte-delimited scope key: `"actor\0nonce\0chainId\0domain"`. Null chain or domain values use `"*"`.

---

### `validateReplayWindow(payload, opts?): ReplayResult`

Check required replay fields, optional chain and domain expectations, expiry, and nonce reuse.

**Input:**
| Parameter | Type | Description |
|---|---|---|
| `payload` | object | Optional `actor`, `nonce`, `expiry`, `chainId`, and `domain` fields |
| `opts.nowSeconds` | number (optional) | Current Unix timestamp in seconds; defaults to `Math.floor(Date.now() / 1000)` |
| `opts.seenNonceKeys` | `Set<string>` (optional) | Previously seen nonce keys |
| `opts.expectedChainId` | `number \| null` (optional) | Expected chain ID |
| `opts.expectedDomain` | `string \| null` (optional) | Expected domain |
| `opts.allowedClockSkewSeconds` | number (optional) | Allowed expiry skew in seconds |

**Output:** `{ ok: boolean, code: string, nonceKey?: string }`

**Codes:** `ok`, `missing_actor`, `missing_nonce`, `missing_expiry`, `chain_mismatch`, `domain_mismatch`, `expired`, `replayed_nonce`

---

### `buildProtocolSigningDomain(opts?): EIP712Domain`

Build the EIP-712 signing domain for ALX Protocol.

**Input:** `{ chainId: number, verifyingContract?: string }`. The entire options object is optional and defaults to chain ID `0`.

**Output:** `{ name: "ALXProtocol", version: "1", chainId, verifyingContract }`

---

### `normalizeSignedProtocolPayload(payload): NormalizedPayload`

Normalize and validate a protocol request payload before signature verification.

**Input:** Raw payload object with `actor`, `nonce`, `expiry`, `chainId`, `domain`, `action`, and `payloadHash`.

**Output:** Normalized payload with validated types and formats.

**Errors:** Throws if any required field is missing or malformed.

---

### `verifySignedProtocolPayload(opts, verifyFn?): VerificationResult`

Verify a signed protocol request, including replay, expiry, actor, and signature checks.

**Input:**
| Parameter | Type | Description |
|---|---|---|
| `opts.payload` | object | Signed payload |
| `opts.signature` | string | EIP-712 signature |
| `opts.expectedSigner` | `string \| null` (optional) | Expected signer address |
| `opts.expectedChainId` | `number \| null` (optional) | Expected chain ID |
| `opts.expectedDomain` | `string \| null` (optional) | Expected domain |
| `opts.seenNonceKeys` | `Set<string>` (optional) | Application-owned replay set |
| `opts.nowSeconds` | number (optional) | Current Unix timestamp in seconds |
| `opts.allowedClockSkewSeconds` | number (optional) | Allowed expiry skew in seconds |
| `opts.verifyingContract` | string (optional) | EIP-712 verifying contract |
| `verifyFn` | function (optional) | Injected typed-data recovery function |

**Output:** `{ ok: boolean, code: string, reason?: string, signer?: string, nonceKey?: string }`

**Codes:** `ok`, `invalid_payload`, `invalid_signature`, `signer_mismatch`, `actor_mismatch`, plus all replay codes.

---

## Operation Classification

| Operation | Category | Required for conformance? |
|---|---|---|
| `canonicalize` | Core | Yes |
| `deriveBlockHash` | Core | Yes |
| `deriveContentHash` | Core | Yes |
| `createBlock` | Core | Yes |
| `validateBlock` | Core | Yes |
| `normalizeHash` | Core | Yes |
| `normalizeHashes` | Core | Yes |
| `sanitizeImportedParentHashes` | SDK import utility | No |
| `validateLineage` | Core | Yes |
| `validateGraph` | Core | Yes |
| `verifyGraph` | Core | Yes |
| `traceAttribution` | Core | Yes |
| `buildMerkleTree` | Merkle extension | No |
| `getMerkleProof` | Merkle extension | No |
| `verifyMerkleProof` | Merkle extension | No |
| `signBlock` | Extension (signing) | No |
| `verifyBlockSignature` | Extension (signing) | No |
| `buildProtocolSigningDomain` | Extension (signing) | No |
| `buildReplayScopeKey` | Extension (replay) | No |
| `validateReplayWindow` | Extension (replay) | No |
| `normalizeSignedProtocolPayload` | Extension (signing) | No |
| `verifySignedProtocolPayload` | Extension (signing) | No |

---

## Related Documents

- [`data-model.md`](./data-model.md) — data structures referenced by the operations above
- [`implementers/conformance.md`](./implementers/conformance.md) — operations required for conformance
- [`protocol/test-vectors/`](../protocol/test-vectors/) — canonical operation inputs and expected outcomes
- [`protocol/spec.md`](../protocol/spec.md) — normative protocol behavior

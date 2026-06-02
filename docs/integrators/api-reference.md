# TypeScript SDK API Reference

TypeScript SDK exports. Protocol behavior remains defined by [`../../protocol/spec.md`](../../protocol/spec.md).

---

## Purpose

Complete reference for every function, interface, and constant exported by the ALX Protocol TypeScript SDK (`@alx-protocol/sdk`).

## Scope

Covers all public exports from the SDK barrel (`index.ts`). Organized by the same layer structure the SDK uses internally.

## Non-Goals

- CLI commands (see [`cli/README.md`](../../cli/README.md))
- Optional extension schemas (see [`protocol/extensions/`](../../protocol/extensions/))
- Protocol specification (see [`protocol/spec.md`](../../protocol/spec.md))

---

## Constants

### `ALX_PROTOCOL_VERSION`

```ts
const ALX_PROTOCOL_VERSION: "1"
```

The protocol version the SDK implements. Integer string matching `protocol/VERSION`.

### `CANONICALIZATION_ALGORITHM`

```ts
const CANONICALIZATION_ALGORITHM: "recursive-json-sort-v1"
```

The canonicalization algorithm identifier. Matches Spec Section 2.

---

## Hash Utilities

Shared hash normalization used by all layers. Import from `@alx-protocol/sdk` or `@alx-protocol/sdk/hash-utils`.

### `HASH_PATTERN`

```ts
const HASH_PATTERN: RegExp  // /^0x[a-f0-9]{64}$/
```

Regex matching a valid ALX hash: `0x`-prefixed, lowercase, 64-character hex string (32 bytes).

### `normalizeHash(hash)`

```ts
function normalizeHash(hash: string): string
```

Lowercases, trims, and validates a hash string. Throws when the result fails to match `HASH_PATTERN`.

| Parameter | Type | Description |
|-----------|------|-------------|
| `hash` | `string` | Raw hash string |

**Returns:** Normalized hash string.

**Throws:** `Error` for any hash failing the 0x-prefixed, 64-char hex format.

```js
normalizeHash("0xABCD" + "0".repeat(60)); // "0xabcd000...000"
normalizeHash("invalid");                  // throws Error
```

### `normalizeHashLenient(hash)`

```ts
function normalizeHashLenient(hash: string): string
```

Lowercases and trims without validation. Graph and Trace layers filter invalid hashes downstream.

### `normalizeHashes(hashes-)`

```ts
function normalizeHashes(hashes-: string[]): string[]
```

Normalizes, deduplicates, and lexicographically sorts an array of hashes. Silently drops entries failing `HASH_PATTERN`.

| Parameter | Type | Description |
|-----------|------|-------------|
| `hashes` | `string[]` (optional) | Raw hash array |

**Returns:** Sorted, deduplicated array of valid hashes. Empty array when input is invalid or non-array.

```js
const p1 = "0x" + "a".repeat(64);
const p2 = "0x" + "b".repeat(64);
normalizeHashes([p2, p1, p1]); // [p1, p2] - sorted, deduplicated
normalizeHashes(["invalid"]);  // [] - dropped
```

---

## Layer 1: Canonicalization

### `canonicalizeProtocolJson(value)`

```ts
function canonicalizeProtocolJson(value: unknown, _depth-: number, _seen-: WeakSet<object>): string
```

Deterministic JSON serialization. Same input always produces the same output string on any platform.

| Parameter | Type | Description |
|-----------|------|-------------|
| `value` | `unknown` | Any JSON-compatible value |

**Returns:** Deterministic canonical string representation.

**Rules:**
- `null` and `undefined` produce `"null"`
- Booleans produce `"true"` or `"false"`
- Numbers: `-0` becomes `"0"`, integers use `String()`, floats use `JSON.stringify()`
- Strings: wrapped in double quotes via `JSON.stringify()`
- Arrays: order-preserving, elements recursively canonicalized
- Objects: keys sorted lexicographically, `undefined` values excluded

**Throws:**
- `BigInt` values
- `Symbol` values
- Non-finite numbers (`NaN`, `Infinity`, `-Infinity`)
- Integers outside safe range (`> Number.MAX_SAFE_INTEGER` or `< Number.MIN_SAFE_INTEGER`)
- Nesting depth exceeding 128
- Cyclic object references

```js
canonicalizeProtocolJson({ z: 1, a: 2 });         // '{"a":2,"z":1}'
canonicalizeProtocolJson([3, 1, 2]);               // '[3,1,2]'
canonicalizeProtocolJson({ a: 1, b: undefined });  // '{"a":1}'
```

---

## Layer 2: Block Operations

### `Block` (Interface)

```ts
interface Block {
  blockHash: string;                // keccak256(canonicalize({ content, parentHashes }))
  contentHash: string;              // keccak256(canonicalize(content))
  parentHashes: string[];           // sorted, deduplicated parent Block hashes
  content: unknown;                 // opaque JSON-serializable payload
  attestation-: BlockAttestation;   // optional authorship proof (excluded from hash)
}
```

The `attestation` field is optional and orthogonal to block identity. A signed Block and an unsigned Block with the same content and parents have the same `blockHash`.

### `BlockValidation` (Interface)

```ts
interface BlockValidation {
  ok: boolean;      // true if blockHash matches (and attestation if verified)
  expected: string; // recomputed hash
  actual: string;   // hash stored in the Block
  attestation-: {   // present when attestation was checked
    ok: boolean;
    attester: string;
    algorithm: string;
    reason-: string;
  };
}
```

### `createBlock(content, parentHashes-)`

```ts
function createBlock(content: unknown, parentHashes-: string[]): Block
```

Create a Block. Normalizes parent hashes (lowercase, deduplicate, sort), computes `blockHash` and `contentHash`.

| Parameter | Type | Description |
|-----------|------|-------------|
| `content` | `unknown` | Any JSON-serializable value. `undefined` converts to `null`. |
| `parentHashes` | `string[]` (optional) | Dependency hashes. Invalid entries are silently dropped. |

**Returns:** Complete `Block` object with computed hashes.

```js
const block = createBlock({ type: "analysis", text: "findings" }, [parentHash]);
```

### `validateBlock(block)`

```ts
function validateBlock(block: Block): BlockValidation
```

Verify that a Block's `blockHash` matches its content and parents. Parent existence is outside the scope of this check.

**Returns:** `{ ok, expected, actual }` where `ok` is `true` if `expected === actual`. Does not check attestation - use `validateSignedBlock` for that.

### `createSignedBlock(content, parentHashes, signer, timestamp-)`

```ts
async function createSignedBlock(
  content: unknown,
  parentHashes: string[] | undefined,
  signer: Signer,
  timestamp-: number,
): Promise<Block>
```

Create a Block with authorship attestation. Computes the same `blockHash` as `createBlock` (deterministic, unchanged), then signs the Block with the provided `Signer` and attaches the attestation.

| Parameter | Type | Description |
|-----------|------|-------------|
| `content` | `unknown` | Any JSON-serializable value |
| `parentHashes` | `string[]` or `undefined` | Dependency hashes |
| `signer` | `Signer` | Algorithm-agnostic signer (see Signing section) |
| `timestamp` | `number` (optional) | Unix seconds. Defaults to `Date.now() / 1000`. |

**Returns:** `Block` with `attestation` field populated.

```js
import { createSignedBlock } from "@alx-protocol/sdk";
import { Eip712Signer } from "@alx-protocol/sdk/eip712";

const signer = new Eip712Signer(wallet, { chainId: 8453 });
const block = await createSignedBlock(
  { type: "ai.response", text: "Quarterly revenue forecast: 12% growth in cloud infrastructure" },
  [],
  signer,
);
console.log(block.attestation.attester); // wallet address
```

### `validateSignedBlock(block, verifier)`

```ts
async function validateSignedBlock(block: Block, verifier: Verifier): Promise<BlockValidation>
```

Verify both hash integrity AND attestation signature. Checks the hash first, then verifies the signature using the provided `Verifier`.

**Returns:** `BlockValidation` with `attestation` field containing verification result.

```js
import { validateSignedBlock } from "@alx-protocol/sdk";
import { Eip712Verifier } from "@alx-protocol/sdk/eip712";

const verifier = new Eip712Verifier({ chainId: 8453 });
const result = await validateSignedBlock(block, verifier);
console.log(result.ok);               // true if both hash and signature valid
console.log(result.attestation.ok);    // true if signature valid
console.log(result.attestation.attester); // recovered signer
```

### `deriveBlockHash(content, parentHashes-)`

```ts
function deriveBlockHash(content: unknown, parentHashes-: string[]): string
```

Compute a Block's identity hash: `keccak256(canonicalize({ content, parentHashes }))`.

### `deriveContentHash(content)`

```ts
function deriveContentHash(content: unknown): string
```

Compute a content hash: `keccak256(canonicalize(content))`. Two Blocks with the same content but different parents share the same `contentHash`.

---

## Layer 3: Graph Validation

### `LineageResult` (Interface)

```ts
interface LineageResult {
  ok: boolean;
  blockHash: string;
  parents: string[];
  duplicates: string[];  // duplicate parent entries
  missing: string[];     // parents not in the known set
  selfRef: boolean;      // Block references itself
  cycle: boolean;        // cycle detected (single-step: self-ref only)
}
```

### `GraphResult` (Interface)

```ts
interface GraphResult {
  ok: boolean;
  blocks: number;
  edges: number;
  roots: string[];          // Blocks with no parents
  issues: LineageResult[];  // only Blocks with problems
}
```

### `VerifyResult` (Interface)

```ts
interface VerifyResult {
  ok: boolean;
  verified: number;
  broken: Array<{
    blockHash: string;
    reason: string;       // "hash_mismatch" | "parent_not_found"
    expected-: string;
    parentHash-: string;
  }>;
}
```

### `validateLineage(blockHash, parentHashes, knownHashes-)`

```ts
function validateLineage(
  blockHash: string,
  parentHashes: string[],
  knownHashes-: Set<string> | string[],
): LineageResult
```

Validate a single Block's lineage. Checks for duplicates, self-references, and missing parents (if the caller passes `knownHashes`).

### `validateGraph(graph)`

```ts
function validateGraph(
  graph: Map<string, string[]> | Array<[string, string[]]>,
): GraphResult
```

Validate an entire Graph for structural integrity. Detects cycles across the full graph using O(V+E) DFS.

### `buildGraph(blocks)`

```ts
function buildGraph(
  blocks: Array<{ blockHash: string; parentHashes-: string[] }>,
): Map<string, string[]>
```

Build a Graph map from an array of Block-like objects. Normalizes all hashes.

### `verifyGraph(blocks, computeHash)`

```ts
function verifyGraph(
  blocks: Array<{ blockHash: string; content: unknown; parentHashes-: string[] }>,
  computeHash: (content: unknown, parentHashes: string[]) => string,
): VerifyResult
```

Verify authenticity: recompute each Block's hash and confirm all parents exist. Stronger than `validateGraph` — `validateGraph` confirms structure; `verifyGraph` proves each Block's hash matches its content and declared parents.

```js
import { deriveBlockHash, verifyGraph } from "@alx-protocol/sdk";
const result = verifyGraph(blocks, deriveBlockHash);
```

---

## Layer 4: Attribution Tracing

### `TraceNode` (Interface)

```ts
interface TraceNode {
  hash: string;
  minDepth: number;    // shortest path from root
  maxDepth: number;    // longest path from root
  pathCount: number;   // distinct paths from root to the node
  parentCount: number; // number of parents the node references
  childCount: number;  // number of nodes that reference the node as parent
}
```

### `TraceEdge` (Interface)

```ts
interface TraceEdge {
  from: string; // child hash
  to: string;   // parent hash
}
```

### `AttributionTrace` (Interface)

```ts
interface AttributionTrace {
  root: string;
  nodes: TraceNode[];   // sorted by minDepth, then hash
  edges: TraceEdge[];   // sorted by from, then to
  leaves: string[];     // sorted; nodes with parentCount === 0
  maxDepth: number;
  cycle: boolean;
}
```

### `traceAttribution(rootHash, graph)`

```ts
function traceAttribution(rootHash: string, graph: Map<string, string[]>): AttributionTrace
```

Resolve the full lineage Trace from a root Block through a Graph. Returns every reachable node, edge, depth, and path count. Deterministic: same inputs always produce identical output.

| Parameter | Type | Description |
|-----------|------|-------------|
| `rootHash` | `string` | The Block to trace from |
| `graph` | `Map<string, string[]>` | Hash-to-parents mapping |

**Throws:** If `rootHash` is empty or `graph` is not a `Map`.

**Algorithm:** O(V+E) - DFS cycle pre-check, BFS discovery, Kahn's topological sort for depth and path-count propagation.

```js
const trace = traceAttribution(decision.blockHash, buildGraph(blocks));
for (const node of trace.nodes) {
  console.log(`${node.hash.slice(0,18)}... paths=${node.pathCount} depth=${node.minDepth}`);
}
```

---

## Merkle Proofs

Off-chain Merkle tree for generating inclusion proofs that optional external checkpoint integrations can verify.

### `MerkleTree` (Interface)

```ts
interface MerkleTree {
  root: string;
  layers: string[][];
}
```

### `MerkleProof` (Interface)

```ts
interface MerkleProof {
  proof: string[];
  root: string;
  leaf: string;
  index: number;
}
```

### `buildMerkleTree(leaves)`

```ts
function buildMerkleTree(leaves: string[]): MerkleTree
```

Build a sorted-pair Merkle tree. The function normalizes leaves (lowercased) and sorts for canonical ordering. Uses `keccak256(concat(min, max))` to match the Merkle extension rule.

**Throws:** When `leaves` is empty or non-array.

### `getMerkleProof(leaves, leaf)`

```ts
function getMerkleProof(leaves: string[], leaf: string): MerkleProof | null
```

Generate an inclusion proof for a specific leaf. Returns `null` when the leaf is absent from the set.

### `verifyMerkleProof(root, leaf, proof)`

```ts
function verifyMerkleProof(root: string, leaf: string, proof: string[]): boolean
```

Verify an inclusion proof locally using the Merkle extension rule.

---

## Signing (EIP-712)

Signing is orthogonal to Block identity. A Block's `blockHash` is always derived from content and parents, never from a signature.

### `Signer` (Interface)

```ts
interface Signer {
  getId(): Promise<string>;              // signer's public identifier
  sign(data: Uint8Array): Promise<string>; // sign data, return signature
  readonly algorithm: string;            // e.g., "eip712", "ed25519"
}
```

Algorithm-agnostic signer. Implement the interface for any signing scheme — EIP-712, Ed25519, RSA, cloud KMS, hardware wallets.

### `Verifier` (Interface)

```ts
interface Verifier {
  verify(data: Uint8Array, signature: string, expectedSigner-: string): Promise<{ ok: boolean; signer: string }>;
  readonly algorithm: string;
}
```

Algorithm-agnostic verifier. Must match the `algorithm` of the `Signer` that produced the signature.

### `Eip712Signer` (Class)

```ts
class Eip712Signer implements Signer {
  algorithm: "eip712";
  constructor(wallet: EthersWallet, opts: { chainId: number; verifyingContract-: string });
}
```

Built-in EIP-712 signer. Requires `ethers` (peer dependency, loaded lazily). Import from `@alx-protocol/sdk/eip712`.

### `Eip712Verifier` (Class)

```ts
class Eip712Verifier implements Verifier {
  algorithm: "eip712";
  constructor(opts: { chainId: number; verifyingContract-: string });
}
```

Built-in EIP-712 verifier. Requires `ethers`. Import from `@alx-protocol/sdk/eip712`.

### `BlockAttestation` (Interface)

```ts
interface BlockAttestation {
  blockHash: string;
  attester: string;   // signer's public identifier
  algorithm: string;  // signing algorithm (e.g., "eip712", "ed25519")
  timestamp: number;  // unix seconds
  signature: string;  // signature over blockHash
}
```

### `signBlock(blockHash, opts)`

```ts
async function signBlock(blockHash: string, opts: {
  signer: { getAddress(): Promise<string>; signTypedData(...): Promise<string> };
  chainId: number;
  verifyingContract-: string;
  timestamp-: number;
}): Promise<BlockAttestation>
```

Sign a Block hash using EIP-712. Creates an attestation that a signer produced or verified the Block.

### `verifyBlockSignature(attestation, opts)`

```ts
async function verifyBlockSignature(attestation: BlockAttestation, opts: {
  chainId: number;
  verifyingContract-: string;
  expectedAttester-: string;
}): Promise<{ ok: boolean; code: string; recoveredAttester-: string; reason-: string }>
```

Verify a Block attestation signature. Recovers the signer and compares against the attestation's `attester`.

### `NormalizedPayload` (Interface)

```ts
interface NormalizedPayload {
  actor: string;
  nonce: string;
  expiry: number;
  chainId: number;
  domain: string;
  action: string;
  payloadHash: string;
}
```

### `VerificationResult` (Interface)

```ts
interface VerificationResult {
  ok: boolean;
  code: string;           // "ok" | "invalid_payload" | "invalid_signature" | "signer_mismatch" | "actor_mismatch" | "expired" | "replayed_nonce" | ...
  reason-: string;
  signer-: string;
  nonceKey-: string;
}
```

### `buildProtocolSigningDomain(opts-)`

```ts
function buildProtocolSigningDomain(opts-: {
  chainId: number;
  verifyingContract-: string;
}): { name: string; version: string; chainId: number; verifyingContract: string }
```

Build the EIP-712 domain separator for ALX Protocol. Domain name is `"ALXProtocol"`, version is `"1"`.

### `verifySignedProtocolPayload(opts, verifyTypedDataFn-)`

```ts
async function verifySignedProtocolPayload(opts: {
  payload: Record<string, unknown>;
  signature: string;
  expectedSigner-: string | null;
  expectedChainId-: number | null;
  expectedDomain-: string | null;
  seenNonceKeys-: Set<string>;
  now-: number;
  allowedClockSkewMs-: number;
  verifyingContract-: string;
}, verifyTypedDataFn-): Promise<VerificationResult>
```

Full verification pipeline: normalize payload, check replay window, recover signer, compare against expected.

### `normalizeSignedProtocolPayload(payload)`

```ts
function normalizeSignedProtocolPayload(payload: Record<string, unknown>): NormalizedPayload
```

Normalize and validate a protocol request payload. Throws on invalid actor, missing nonce, or invalid expiry.

### Signing Constants

```ts
const PROTOCOL_SIGNING_DOMAIN_NAME: "ALXProtocol"
const PROTOCOL_SIGNING_DOMAIN_VERSION: "1"
const BLOCK_ATTESTATION_TYPES: { BlockAttestation: [...] }
const PROTOCOL_SIGNED_REQUEST_TYPES: { ProtocolRequest: [...] }
```

---

## Replay Protection

### `ReplayResult` (Interface)

```ts
interface ReplayResult {
  ok: boolean;
  code: string;      // "ok" | "missing_actor" | "missing_nonce" | "missing_expiry" | "chain_mismatch" | "domain_mismatch" | "expired" | "replayed_nonce"
  nonceKey-: string;
}
```

### `buildReplayScopeKey(opts)`

```ts
function buildReplayScopeKey(opts: {
  actor: string;
  nonce: string;
  chainId-: number | null;
  domain-: string | null;
}): string
```

Build a scoped nonce key: `"actor:nonce:chainId:domain"`. Wildcards (`*`) used for null values.

### `validateReplayWindow(payload, opts-)`

```ts
function validateReplayWindow(
  payload: { actor-; nonce-; expiry-; chainId-; domain- },
  opts-: {
    now-: number;
    seenNonceKeys-: Set<string>;
    expectedChainId-: number | null;
    expectedDomain-: string | null;
    allowedClockSkewMs-: number;
  },
): ReplayResult
```

Check that a signed request has a valid expiry window and an unused nonce. Pass a `Set<string>` as `seenNonceKeys` and add successful `nonceKey` values to the set to track seen nonces.

---

## Middleware (AI Client Wrapper)

Import from `@alx-protocol/sdk/middleware`. The middleware module is separate from the main SDK barrel — the module depends on Node.js built-ins (`fs/promises`) and is excluded from the core bundle.

```ts
import { alxMiddleware, lockBind } from "@alx-protocol/sdk/middleware";
```

The middleware intercepts `messages.create` and `messages.stream` calls on any provider client that satisfies the `MessagesClient` interface and auto-seals each prompt + response pair into linked Blocks. See [Provider Integration](./providers.md) for per-provider setup.

---

### `AlxMiddlewareOptions` (Interface)

```ts
interface AlxMiddlewareOptions {
  outDir?: string;
  onLock?: (pair: LockedBind) => void | Promise<void>;
  onError?: (err: unknown, pair: LockedBind) => void;
  onEvict?: (pair: LockedBind) => void | Promise<void>;
  promptMeta?: Record<string, unknown>;
  responseMeta?: Record<string, unknown>;
  maxHistory?: number;
  now?: () => string;
  extractText?: (response: unknown) => string;
  extractModel?: (params: unknown, response: unknown) => string | undefined;
  streamCompleteEvent?: string;
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `outDir` | `string` | — | Directory to write `.block.json` files. Omit to collect in-memory only. |
| `onLock` | `(pair) => void \| Promise<void>` | — | Fires after each pair locks. Use for custom persistence or logging. |
| `onError` | `(err, pair) => void` | `console.error` | Called when a side effect (`onLock`, `outDir` write, `onEvict`) throws. Errors never propagate to the caller. |
| `onEvict` | `(pair) => void \| Promise<void>` | — | Fires before the middleware removes an entry due to `maxHistory`. Use to flush evicted pairs before loss. |
| `promptMeta` | `Record<string, unknown>` | — | Extra fields merged into prompt block content (e.g. `{ pipeline: "q4-analysis" }`). |
| `responseMeta` | `Record<string, unknown>` | — | Extra fields merged into response block content. |
| `maxHistory` | `number` | `100` | Maximum pairs kept in history. Middleware evicts oldest first. `0` = unlimited. |
| `now` | `() => string` | `() => new Date().toISOString()` | Inject wall-clock time. Use in tests for deterministic timestamps. |
| `extractText` | `(response: unknown) => string` | `content[].text` (default) | Extract response text from the provider response object. Override for providers with a different response shape. See [Provider Integration](./providers.md). |
| `extractModel` | `(params, response) => string \| undefined` | `response.model` (default) | Extract the model identifier from the provider response. |
| `streamCompleteEvent` | `string` | `"message"` | Event name emitted by the stream with the full accumulated response. Override for providers that use a different event name. |

---

### `LockedBind` (Interface)

```ts
interface LockedBind {
  promptBlock: Block;
  responseBlock: Block;
  at: string;
  via: "create" | "stream";
}
```

| Field | Description |
|-------|-------------|
| `promptBlock` | Block locking the prompt parameters (`content.type = "ai.prompt"`). |
| `responseBlock` | Block locking the response text (`content.type = "ai.response"`). `parentHashes` contains exactly `[promptBlock.blockHash]`. |
| `at` | ISO 8601 wall-clock time the response was fully received. |
| `via` | `"create"` for `messages.create`, `"stream"` for `messages.stream`. |

---

### `alxMiddleware(client, opts-)`

```ts
function alxMiddleware<T extends MessagesClient>(
  client: T,
  opts?: AlxMiddlewareOptions,
): T & { _alx: { history: LockedBind[] } }
```

Wrap any AI provider client to auto-lock every `messages.create` and `messages.stream` call into linked Blocks.

Returns a `Proxy` that passes all properties through unchanged, except `messages.create` and `messages.stream`, which the middleware intercepts.

| Parameter | Type | Description |
|-----------|------|-------------|
| `client` | `T extends MessagesClient` | Any provider client exposing `messages.create` / `messages.stream`. |
| `opts` | `AlxMiddlewareOptions` (optional) | Middleware configuration. |

**Returns:** Proxied client with `_alx.history` attached.

**`messages.create` intercept:**
Awaits the full response, locks the prompt + response bind, runs side effects, and returns the original response extended with `._alx: LockedBind`.

**`messages.stream` intercept:**
Returns the stream immediately (the caller can iterate chunks normally). Locks on the `"message"` event (full accumulated message after `message_stop`). The stream object carries `._alx: Promise<LockedBind>` that resolves when locking completes or rejects if the stream errors before `message_stop`.

**Side-effect isolation:** `onLock`, file write, and `onEvict` errors forward to `onError` and never reach the caller.

```ts
import { alxMiddleware } from "@alx-protocol/sdk/middleware";

const client = alxMiddleware(yourProviderClient, {
  outDir: ".alx/blocks",
  onLock: async (pair) => {
    console.log("locked", pair.responseBlock.blockHash);
  },
});

// Non-streaming
const msg = await client.messages.create({
  model: "your-model-id",
  max_tokens: 1024,
  messages: [{ role: "user", content: "Analyze Q4 trends" }],
});
console.log(msg._alx.responseBlock.blockHash);
console.log(msg._alx.promptBlock.blockHash);

// Streaming
const stream = client.messages.stream({
  model: "your-model-id",
  max_tokens: 1024,
  messages: [{ role: "user", content: "Summarize the report" }],
});
for await (const chunk of stream) { /* process chunks */ }
const pair = await stream._alx;
console.log(pair.responseBlock.blockHash);
console.log(pair.via); // "stream"
```

**History access:**

```ts
const { history } = client._alx;
console.log(history.length);
console.log(history[0].promptBlock.blockHash);
```

**Bounded history with eviction:**

```ts
const client = alxMiddleware(yourProviderClient, {
  maxHistory: 50,
  onEvict: async (pair) => {
    await archiveToDatabase(pair);
  },
});
```

**Deterministic timestamps for tests:**

```ts
const client = alxMiddleware(fakeClient, {
  now: () => "2026-01-01T00:00:00.000Z",
});
```

---

### `lockBind(prompt, response, opts-)`

```ts
function lockBind(
  prompt: { content?: unknown; model?: string; [key: string]: unknown },
  response: { text: string; model?: string; [key: string]: unknown },
  opts?: { meta?: Record<string, unknown>; at?: string },
): LockedBind
```

Manually lock a prompt + response pair without wrapping a client. Use for frameworks or calling conventions that don't fit the `alxMiddleware` wrapper.

| Parameter | Type | Description |
|-----------|------|-------------|
| `prompt` | `object` | Prompt fields. Spread into prompt block content alongside `type: "ai.prompt"`. |
| `response` | `object` | Response fields. Must include `text`. Spread into response block content alongside `type: "ai.response"`. |
| `opts.meta` | `Record<string, unknown>` | Extra fields merged into both prompt and response block content. |
| `opts.at` | `string` | ISO 8601 timestamp. Defaults to `new Date().toISOString()`. Pass explicitly for deterministic tests. |

**Returns:** `LockedBind` with `via: "create"`.

```ts
import { lockBind } from "@alx-protocol/sdk/middleware";

const pair = lockBind(
  { content: "What is the Q4 revenue forecast?", model: "your-model-id" },
  { text: "Projected growth of 12% based on pipeline data.", model: "your-model-id" },
  { at: new Date().toISOString() },
);

console.log(pair.promptBlock.blockHash);
console.log(pair.responseBlock.parentHashes); // [pair.promptBlock.blockHash]
console.log(pair.via); // "create"
```

**With shared metadata:**

```ts
const pair = lockBind(
  { content: "Analyze risk factors" },
  { text: "Three primary risks identified..." },
  { meta: { pipeline: "risk-assessment", version: "2.1" } },
);
// pair.promptBlock.content.pipeline === "risk-assessment"
// pair.responseBlock.content.pipeline === "risk-assessment"
```

---

### `lock(content, opts-)` (Block utility)

Exported from `@alx-protocol/sdk` (not `middleware`). Ergonomic alias for `createBlock` that accepts parent `Block` objects directly.

```ts
function lock(
  content: unknown,
  opts?: { parents?: Block[] | string[] },
): Block
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `content` | `unknown` | Any JSON-serializable value. |
| `opts.parents` | `Block[] \| string[]` | Parent Blocks or raw `blockHash` strings. Mixed arrays are allowed. |

**Returns:** Complete `Block` with computed hashes.

```ts
import { lock } from "@alx-protocol/sdk";

const source = lock({ type: "document", text: "Q4 report" });
const analysis = lock(
  { type: "ai.response", text: "Revenue up 12%" },
  { parents: [source] },
);
console.log(analysis.parentHashes); // [source.blockHash]
```

---

## Related Documents

- [`../../protocol/spec.md`](../../protocol/spec.md) -- normative protocol specification
- [`../operations.md`](../operations.md) -- operation classification and semantics
- [`../data-model.md`](../data-model.md) -- data structure definitions
- [`./quickstart.md`](./quickstart.md) -- five-minute getting-started tutorial
- [`./troubleshooting.md`](./troubleshooting.md) -- error diagnosis and fixes
- [`./providers.md`](./providers.md) -- provider integration and extractor examples
- [`../../sdk/src/middleware.ts`](../../sdk/src/middleware.ts) -- middleware source

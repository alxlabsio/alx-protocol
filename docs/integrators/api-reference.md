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

Lowercases and trims a string without validating its hash format. Non-string values throw `ALX_INVALID_HASH`.

### `normalizeHashes(hashes?)`

```ts
function normalizeHashes(hashes?: string[]): string[]
```

Normalizes, deduplicates, and lexicographically sorts an array of hashes. Omitted input returns an empty array. A supplied non-array or invalid entry throws `ALX_INVALID_HASH` without returning a partial set.

| Parameter | Type | Description |
|-----------|------|-------------|
| `hashes` | `string[]` (optional) | Raw hash array |

**Returns:** Sorted, deduplicated array of valid hashes.

```js
const p1 = "0x" + "a".repeat(64);
const p2 = "0x" + "b".repeat(64);
normalizeHashes([p2, p1, p1]); // [p1, p2] - sorted, deduplicated
normalizeHashes(["invalid"]);  // throws ALX_INVALID_HASH
```

### `sanitizeImportedParentHashes(hashes?)`

```ts
type RejectedParentHashReason =
  | "not_array"
  | "invalid_type"
  | "invalid_format";

interface SanitizedParentHashes {
  ok: boolean;
  parentHashes: string[];
  rejected: Array<{
    index: number | null;
    value: unknown;
    reason: RejectedParentHashReason;
  }>;
  duplicates: Array<{
    index: number;
    hash: string;
  }>;
  collectionErrors: Array<{
    reason: "too_many_parents";
    count: number;
    maximum: number;
  }>;
}

function sanitizeImportedParentHashes(
  hashes?: unknown,
): SanitizedParentHashes
```

Inspects parent hashes at an untrusted import boundary without changing core Block behavior.

`parentHashes` contains the sorted unique valid subset. `rejected` preserves original indexes and values for malformed entries. `duplicates` records duplicate indexes and normalized hashes. `collectionErrors` reports a normalized set exceeding 256 entries.

`ok` is `false` when entries are rejected or the normalized collection exceeds `MAX_PARENTS`. Duplicate-only input remains usable. Callers pass `parentHashes` to core operations only when `ok` is `true`.

```ts
const imported = [
  "0x" + "A".repeat(64),
  "invalid",
];
const result = sanitizeImportedParentHashes(imported);

result.ok;                 // false
result.parentHashes;       // one normalized hash
result.rejected[0].reason; // "invalid_format"
```

`createBlock()`, `deriveBlockHash()`, and `normalizeHashes()` call strict normalization directly and reject malformed input.

---

## Layer 1: Canonicalization

### `canonicalizeProtocolJson(value)`

```ts
function canonicalizeProtocolJson(value: unknown, _depth?: number, _seen?: WeakSet<object>): string
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
  blockHash: string;
  contentHash: string;
  parentHashes: string[];
  content: unknown;
  protocolVersion?: string;
}
```

`Block` contains only core identity and content fields. `protocolVersion` defaults to `"1"` when absent and remains outside hash derivation.

### `SignedBlock` (Interface)

```ts
interface SignedBlock {
  block: Block;
  attestation?: BlockAttestation;    // deprecated singular compatibility field
  attestations?: BlockAttestation[];
}
```

`SignedBlock` is an optional signing-extension wrapper. Attestation material remains outside the core `Block` and does not change `blockHash`.

### Validation Result Interfaces

```ts
interface HashValidationResult {
  stored: string;
  recomputed: string;
  match: boolean;
}

interface AttestationValidation {
  ok: boolean;
  attester: string;
  algorithm: string;
  reason?: string;
}

interface BlockValidation {
  ok: boolean;
  expected: string;
  actual: string;
  expectedContentHash?: string;
  actualContentHash?: string;
  canonicalParents?: string[];
  parentsCanonical?: boolean;
  selfRef?: boolean;
  blockHash: HashValidationResult;
  contentHash: HashValidationResult;
  attestation?: AttestationValidation;
  attestations?: AttestationValidation[];
}
```

`expected` and `actual` expose the recomputed and stored `blockHash` values for compatibility. The structured `blockHash` and `contentHash` results are always present.

### `createBlock(content, parentHashes?)`

```ts
function createBlock(content: unknown, parentHashes?: string[]): Block
```

Create a Block. The function normalizes parent hashes, computes `blockHash` and `contentHash`, and sets `protocolVersion` to `"1"`.

| Parameter | Type | Description |
|-----------|------|-------------|
| `content` | `unknown` | Any JSON-serializable value. `undefined` converts to `null`. |
| `parentHashes` | `string[]` (optional) | Parent Block hashes. Malformed collections or entries throw `ALX_INVALID_HASH`. |

**Returns:** Complete core `Block` with computed identity fields.

### `validateBlock(block)`

```ts
function validateBlock(block: Block): BlockValidation
```

Validate `blockHash`, `contentHash`, canonical parent ordering, self-reference, and `protocolVersion`. Parent availability and attestation verification are separate checks.

### `createSignedBlock(content, parentHashes, signer, timestamp?)`

```ts
async function createSignedBlock(
  content: unknown,
  parentHashes: string[] | undefined,
  signer: Signer,
  timestamp?: number,
): Promise<SignedBlock>
```

Create a core Block, sign its existing `blockHash`, and return a `SignedBlock` wrapper. The optional timestamp uses Unix seconds and defaults to `Math.floor(Date.now() / 1000)` in this imperative signing shell.

### `validateSignedBlock(signedBlock, verifier)`

```ts
async function validateSignedBlock(
  signedBlock: SignedBlock,
  verifier: Verifier | Map<string, Verifier>,
): Promise<BlockValidation>
```

Validate the wrapped core Block before checking every attestation. A verifier map supports signed Blocks containing multiple signing algorithms.

### `deriveBlockHash(content, parentHashes?)`

```ts
function deriveBlockHash(content: unknown, parentHashes?: string[]): string
```

Compute a Block identity hash from canonicalized `content` and normalized `parentHashes`.

### `deriveContentHash(content)`

```ts
function deriveContentHash(content: unknown): string
```

Compute the content-only hash. Blocks with the same content and different parents share the same `contentHash`.

---

## Layer 3: Graph Validation

### Graph Result Interfaces

```ts
interface LineageResult {
  ok: boolean;
  blockHash: string;
  parents: string[];
  duplicates: string[];
  missing: string[];
  external: string[];
  selfRef: boolean;
  cycle: boolean;
}

interface GraphValidationContext {
  validationMode?: "closed-world" | "open-world";
  externalParents?: Array<{ hash: string }>;
}

interface GraphResult {
  ok: boolean;
  blocks: number;
  edges: number;
  roots: string[];
  mode: "closed-world" | "open-world";
  externalParents: string[];
  issues: LineageResult[];
}

interface VerifyResult {
  ok: boolean;
  verified: number;
  broken: Array<{
    blockHash: string;
    reason: string;
    expected?: string;
    parentHash?: string;
  }>;
}
```

### `validateLineage(blockHash, parentHashes, knownHashes?, context?)`

```ts
function validateLineage(
  blockHash: string,
  parentHashes: string[],
  knownHashes?: Set<string> | string[],
  context?: GraphValidationContext,
): LineageResult
```

Validate one Block's declared parents, duplicate references, self-reference, and parent availability under the selected validation mode.

### `validateGraph(graph, context?)`

```ts
function validateGraph(
  graph: Map<string, string[]> | Array<[string, string[]]>,
  context?: GraphValidationContext,
): GraphResult
```

Validate a complete Graph and detect cycles using O(V+E) traversal. Closed-world validation is the default.

### `buildGraph(blocks)`

```ts
function buildGraph(
  blocks: Array<{ blockHash: string; parentHashes?: string[] }>,
): Map<string, string[]>
```

`buildGraph()` builds a Graph map and normalizes the hashes declared by each Block-like object.

### `verifyGraph(blocks, computeHash)`

```ts
function verifyGraph(
  blocks: Array<{ blockHash: string; content: unknown; parentHashes?: string[] }>,
  computeHash: (content: unknown, parentHashes: string[]) => string,
): VerifyResult
```

Recompute every Block hash and confirm that each parent resolves inside the supplied collection.

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

Signing is an optional extension around core Blocks. Signature and attestation material never enters `blockHash` derivation.

### `Signer` And `Verifier` Interfaces

```ts
interface Signer {
  getId(): Promise<string>;
  sign(data: Uint8Array): Promise<string>;
  readonly algorithm: string;
}

interface Verifier {
  verify(
    data: Uint8Array,
    signature: string,
    expectedSigner?: string,
  ): Promise<{ ok: boolean; signer: string }>;
  readonly algorithm: string;
}
```

### `Eip712Signer` And `Eip712Verifier` Classes

```ts
class Eip712Signer implements Signer {
  readonly algorithm: "eip712";
  constructor(
    wallet: EthersWallet,
    opts: { chainId: number; verifyingContract?: string; timestamp?: number },
  );
}

class Eip712Verifier implements Verifier {
  readonly algorithm: "eip712";
  constructor(opts: { chainId: number; verifyingContract?: string });
}
```

The classes are exported from `@alx-protocol/sdk/eip712`. EIP-712 signing requires an ethers-compatible wallet. Verification uses `@noble/secp256k1` when available and falls back to `ethers`.

### `BlockAttestation` (Interface)

```ts
interface BlockAttestation {
  blockHash: string;
  attester: string;
  algorithm: string;
  timestamp: number;
  signature: string;
}
```

### Deprecated EIP-712 Helpers

`signBlock()` and `verifyBlockSignature()` remain exported for compatibility and are deprecated for removal in v2.0. New integrations use `createSignedBlock()` with `Eip712Signer` and `validateSignedBlock()` with `Eip712Verifier`.

```ts
async function signBlock(blockHash: string, opts: {
  signer: {
    getAddress(): Promise<string>;
    signTypedData(domain: object, types: object, value: object): Promise<string>;
  };
  chainId: number;
  verifyingContract?: string;
  timestamp?: number;
}): Promise<BlockAttestation>

async function verifyBlockSignature(attestation: BlockAttestation, opts: {
  chainId: number;
  verifyingContract?: string;
  expectedAttester?: string;
}): Promise<{
  ok: boolean;
  code: string;
  recoveredAttester?: string;
  reason?: string;
}>
```

### Signed Protocol Payload Interfaces

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

interface VerificationResult {
  ok: boolean;
  code: string;
  reason?: string;
  signer?: string;
  nonceKey?: string;
}
```

### `buildProtocolSigningDomain(opts?)`

```ts
function buildProtocolSigningDomain(opts?: {
  chainId: number;
  verifyingContract?: string;
}): { name: string; version: string; chainId: number; verifyingContract: string }
```

Build the EIP-712 domain for ALX Protocol. The domain name is `"ALXProtocol"`, the version is `"1"`, and an omitted options object uses chain ID `0`.

### `verifySignedProtocolPayload(opts, verifyTypedDataFn?)`

```ts
type VerifyTypedDataFn = (
  domain: object,
  types: object,
  value: object,
  signature: string,
) => string;

async function verifySignedProtocolPayload(opts: {
  payload: Record<string, unknown>;
  signature: string;
  expectedSigner?: string | null;
  expectedChainId?: number | null;
  expectedDomain?: string | null;
  seenNonceKeys?: Set<string>;
  nowSeconds?: number;
  allowedClockSkewSeconds?: number;
  verifyingContract?: string;
}, verifyTypedDataFn?: VerifyTypedDataFn): Promise<VerificationResult>
```

Normalize the payload, validate its replay window in Unix seconds, recover the signer, and compare the recovered identity with the expected signer and payload actor.

### `normalizeSignedProtocolPayload(payload)`

```ts
function normalizeSignedProtocolPayload(
  payload?: Record<string, unknown>,
): NormalizedPayload
```

Normalize and validate a signed protocol payload. Invalid addresses, hashes, expiry values, chain IDs, domains, actions, or nonces raise protocol errors.

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
  code: string;
  nonceKey?: string;
}
```

### `buildReplayScopeKey(opts)`

```ts
function buildReplayScopeKey(opts: {
  actor: string;
  nonce: string;
  chainId?: number | null;
  domain?: string | null;
}): string
```

Build a scoped nonce key with null-byte separators: `"actor\0nonce\0chainId\0domain"`. Null `chainId` or `domain` values use `"*"`.

### `validateReplayWindow(payload, opts?)`

```ts
function validateReplayWindow(
  payload: {
    actor?: string;
    nonce?: string;
    expiry?: number;
    chainId?: number | null;
    domain?: string | null;
  },
  opts?: {
    nowSeconds?: number;
    seenNonceKeys?: Set<string>;
    expectedChainId?: number | null;
    expectedDomain?: string | null;
    allowedClockSkewSeconds?: number;
  },
): ReplayResult
```

`validateReplayWindow()` validates required replay fields, optional chain and domain expectations, expiry in Unix seconds, and nonce reuse. A successful result returns the scoped `nonceKey`. Applications persist successful keys in an application-owned set.

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

### `alxMiddleware(client, opts?)`

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

### `lockBind(prompt, response, opts?)`

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

### `lock(content, opts?)` (Block utility)

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

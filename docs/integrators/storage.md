# Blocks And Storage

This document explains storage boundaries around ALX Blocks. This document leaves core Block identity to the protocol specification.

ALX Protocol defines Blocks as protocol objects. Storage is explicitly outside the protocol boundary.

---

## Core Principle

**A Block is valid if and only if its hash matches its content and parents. Storage location is irrelevant to validity.**

```
Valid Block = blockHash == keccak256(canonicalize({ content, parentHashes }))
```

This holds whether the Block lives in a content-addressed storage system, a database, a filesystem, an object store, Git, chain-indexed storage, or memory. The protocol MUST NOT require any specific storage backend.

---

## Protocol Core Scope

| Concern | Protocol role |
|---|---|
| Block identity | Derived from content + parents via keccak-256 |
| Block integrity | Verifiable by recomputing the hash |
| Block lineage | Encoded in `parentHashes` - references, not locations |
| Block attribution | Computed from the graph structure |

## Infrastructure Responsibilities

| Concern | Outside protocol scope |
|---|---|
| Where blocks are persisted | Storage layer decision |
| How blocks are retrieved | Transport layer decision |
| How blocks are indexed | Application layer decision |
| How blocks are replicated | Infrastructure layer decision |
| Block availability guarantees | SLA of the storage backend |

---

## Storage Independence

`parentHashes` are content-addressed references. Identification uses hash rather than location:

- A block referencing `0xabc...` as a parent leaves the storage location of `0xabc...` to the application layer
- The parent might be in a content-addressed storage system, a Postgres database, an object store, or remain unpersisted
- The protocol validates the *reference* (hash format, no cycles, no self-reference) and leaves *resolution* to the application layer
- Resolution is an application-level concern

---

## Common Storage Patterns

### Content-Addressed Storage
Blocks map naturally to content-addressed storage because both use content-addressing. A block's `blockHash` can serve as a lookup key, though the hash algorithms differ (keccak-256 versus content-derived identifier v1). Applications typically maintain a mapping between `blockHash` and a content-derived storage identifier. For guaranteed long-term persistence, pin Blocks to pinning storage providers. ALX validates identically in any storage system.

### Databases
Blocks are JSON objects. Store Blocks in any database with `blockHash` as the primary key. The four Block fields are the only schema requirement.

### Filesystems
One file per Block, named by hash: `0xabc123...def.block.json`. The canonical artifact packages demonstrate the same storage boundary with `block.json`, `content.json`, `blocks.json`, and `manifest.json`.

### External Checkpoints

ALX core verification requires no on-chain storage. Optional external checkpoint integrations can reference Merkle roots or Block hashes, but those references stay outside Block identity. Individual Blocks remain off-chain data and validate independently of checkpoint availability.

---

## Proof By Code: Same Block, Four Storage Backends

The same block validates identically regardless of storage location.

### In-Memory

```javascript
import { createBlock, validateBlock } from "@alx-protocol/sdk";

const block = createBlock({ type: "test", value: 42 }, []);

// Store in a Map
const store = new Map();
store.set(block.blockHash, block);

// Retrieve and validate
const retrieved = store.get(block.blockHash);
console.log(validateBlock(retrieved)); // { ok: true, ... }
```

### Filesystem

```javascript
import { writeFileSync, readFileSync } from "node:fs";
import { createBlock, validateBlock } from "@alx-protocol/sdk";

const block = createBlock({ type: "test", value: 42 }, []);

// Store as JSON file
writeFileSync(`${block.blockHash}.json`, JSON.stringify(block));

// Retrieve and validate
const raw = readFileSync(`${block.blockHash}.json`, "utf-8");
const retrieved = JSON.parse(raw);
console.log(validateBlock(retrieved)); // { ok: true, ... }
```

### PostgreSQL

```javascript
import { createBlock, validateBlock } from "@alx-protocol/sdk";

const block = createBlock({ type: "test", value: 42 }, []);

// Store
await db.query(
  `INSERT INTO blocks (block_hash, content_hash, parent_hashes, content)
   VALUES ($1, $2, $3, $4)`,
  [block.blockHash, block.contentHash, JSON.stringify(block.parentHashes), JSON.stringify(block.content)]
);

// Retrieve and validate
const row = await db.query(`SELECT * FROM blocks WHERE block_hash = $1`, [block.blockHash]);
const retrieved = {
  blockHash: row.block_hash,
  contentHash: row.content_hash,
  parentHashes: JSON.parse(row.parent_hashes),
  content: JSON.parse(row.content),
};
console.log(validateBlock(retrieved)); // { ok: true, ... }
```

### Content-Addressed Storage

```javascript
import { createBlock, validateBlock } from "@alx-protocol/sdk";

const block = createBlock({ type: "test", value: 42 }, []);

// storageClient is a content-addressed storage client
// Pin to content-addressed storage
const cid = await storageClient.add(JSON.stringify(block));
// Note: content-derived storage identifier != blockHash. Maintain a mapping if needed.

// Retrieve and validate
const raw = await storageClient.cat(cid);
const retrieved = JSON.parse(raw);
console.log(validateBlock(retrieved)); // { ok: true, ... }
```

All four produce `{ ok: true }`. The storage backend is irrelevant to validity.

---

## Recommended Adapter Interface

Applications that need pluggable storage SHOULD implement a `BlockStore` interface:

```typescript
interface BlockStore {
  put(block: Block): Promise<void>;
  get(hash: string): Promise<Block | null>;
  has(hash: string): Promise<boolean>;
}
```

See [`extensions.md`](./extensions.md) for detailed adapter patterns.

---

## Anti-Patterns

- **Storing blocks only in a specific system** and treating that system as the source of truth. The hash is the source of truth, independent of storage location.
- **Requiring a specific storage backend for protocol operation.** If an implementation fails when the storage backend changes, the implementation couples protocol logic to storage.
- **Using storage-layer identifiers (content-derived storage identifiers, database row IDs) as block identity.** Block identity is always `blockHash` — derived from content and parents, independent of storage system.

---

## IPFS Integration

IPFS is a recommended storage backend for Blocks that need decentralized availability. ALX and IPFS share the content-addressing principle but use different hash functions — complementary primitives, each with distinct identity schemes.

### blockHash vs. CID

| Property | ALX `blockHash` | IPFS CID |
|---|---|---|
| Hash function | Keccak-256 | SHA-256 (multihash) |
| Input | `canonicalize({ content, parentHashes })` | Raw file bytes |
| Format | `0x` + 64 hex chars | `bafybei...` (base32 CIDv1) |
| Verifiable by | ALX SDK (`validateBlock`) | IPFS protocol |

The identifiers differ. A Block pinned to IPFS carries a `blockHash` (for ALX protocol verification) and a CID (for IPFS retrieval). Applications MUST maintain a blockHash-to-CID mapping.

### Publishing a Block to IPFS

```bash
# Pin a Block to a local Kubo node and register the CID
alx block publish research.block.json --ipfs http://localhost:5001

# Output:
#   ✓ Pinned to IPFS
#     CID:      bafybeihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku
#     Gateway:  https://ipfs.io/ipfs/bafybei...
#     Registry: updated ~/.alx/registry.json
```

The local registry (`~/.alx/registry.json`) stores the `blockHash → CID` mapping. `alx block resolve` uses this registry to look up the CID and fetch via the gateway.

### Resolving a Block by blockHash

```bash
# Resolve using the local registry and default IPFS gateway
alx block resolve 0xabc123...

# Use a custom gateway or a direct HTTP endpoint
alx block resolve 0xabc123... --gateway https://dweb.link/ipfs
alx block resolve 0xabc123... --endpoint https://api.myservice.com

# Machine-readable output
alx block resolve 0xabc123... --json
```

Resolution order:
1. HTTP retrieval endpoint (`GET /block/{blockHash}`) if `--endpoint` appears in the call
2. Local registry (`~/.alx/registry.json`) → IPFS gateway

The CLI verifies every fetched Block against the requested `blockHash` before returning the Block. Local recomputation is required; fetching from a trusted source is insufficient alone.

### Programmatic resolution

```javascript
import { resolveBlock, publishToIpfs, registerCid } from "@alx-protocol/cli/lib/resolve.js";

// Publish a Block to a Kubo node
const cid = await publishToIpfs(block, "http://localhost:5001");
registerCid(block.blockHash, cid, "ipfs");

// Resolve later
const result = await resolveBlock(block.blockHash, {
  gateway: "https://ipfs.io/ipfs",
  endpoint: "https://api.myservice.com",
});

if (result) {
  console.log(result.block);   // verified Block
  console.log(result.source);  // "ipfs-gateway" or "http-endpoint"
}
```

### Registry format

`~/.alx/registry.json` stores the mapping between ALX block hashes and IPFS CIDs:

```json
{
  "version": "1",
  "entries": {
    "0xabc123...": {
      "cid": "bafybeihdwdcefgh4...",
      "source": "ipfs",
      "registeredAt": "2026-05-30T12:00:00.000Z"
    }
  }
}
```

A custom registry path can be specified with `--registry <path>` on any `alx block publish` or `alx block resolve` call.

### Pinning services

Kubo is optional. Any IPFS pinning service that exposes a Kubo-compatible HTTP API works:

| Service | Endpoint |
|---|---|
| Local Kubo node | `http://localhost:5001` |
| Pinata | `https://api.pinata.cloud` (with API key auth) |
| web3.storage | `https://api.web3.storage` |
| Infura IPFS | `https://ipfs.infura.io:5001` |

For services that require authentication, set the appropriate authorization headers in a proxy or use the service's SDK before passing the CID to `registerCid`.

### Retrieval API

The `protocol/retrieval-api.yaml` specification defines a standard HTTP interface for Block storage and retrieval:

```
GET  /block/{blockHash}    → Block | 404
POST /block                → { blockHash, cid? } | 400
HEAD /block/{blockHash}    → 200 | 404
POST /blocks               → { blocks, missing }
GET  /block/{blockHash}/cid → { blockHash, cid, gatewayUrl }
```

The API is advisory (marked non-normative in `protocol/retrieval-api.yaml`). The reference CLI implements the interface via `alx retrieval start` (default port **8081**), separate from the verification API (`alx server start` on port **8080**). This pattern is a **developer convenience** for trusted team networks—not a production trustless multi-party resolution layer. Unrelated parties need **`alx.index`**, shared **`alx.registry`** catalogs, or optional **ALX anchor** on Base—not HTTP retrieval alone.

### Team resolution (shared retrieval server)

For multi-developer workflows before an on-chain anchor exists, run a shared retrieval server instead of relying on per-machine `~/.alx/registry.json`:

```bash
# Alice — host the shared store
alx retrieval start --port 8081 --data-dir ./team-retrieval

# Alice — publish Block bytes and optional CID metadata
alx block publish research.block.json \
  --endpoint http://alice:8081 \
  --ipfs http://localhost:5001

# Bob — resolve by blockHash only (no local registry required)
alx block resolve 0xabc123... --endpoint http://alice:8081
```

The retrieval server validates Blocks on write (`validateBlock`) and clients re-verify `blockHash` after fetch. The pattern suits trusted team networks (VPN, localhost, staging). Cross-party lookup without manual CID sharing uses off-chain **`alx.registry`** / **`alx.index`** Blocks or optional **ALX anchor** on Base; the HTTP retrieval server alone is insufficient for this purpose.

Reference-only publish envelope (informative): the reference server also accepts `{ "block": { ... }, "cid": "bafy..." }` on `POST /block` so IPFS CIDs can be indexed for `GET /block/{blockHash}/cid`. The OpenAPI spec documents this as `PublishBlockRequest` in [`protocol/retrieval-api.yaml`](../../protocol/retrieval-api.yaml) (also published at `https://xandrlabs.github.io/alx-protocol/protocol/1/retrieval-api.yaml`).

### Resolution layers (minimal chain)

Default integration uses **no blockchain**:

1. **Registry Block** (`alx.registry`) — what exists; entries carry `blockHash` and `cid`
2. **IPFS + local registry / `alx block publish`** — where bytes live
3. **`alx retrieval start`** — shared team host (staging/VPN)

Use chain **only** when step 3 is insufficient for unrelated parties that have only a `blockHash`:

| Layer | Default? | Role |
| --- | --- | --- |
| **Registry Block** | Yes | Off-chain catalog and discovery |
| **Retrieval API / local registry** | Yes | Team fetch and publish |
| **ALX anchor (ALXAnchor)** | No — opt-in | Rare existence-time or blockset commit on Base |
| **Optional Base CID pointer read** | No — opt-in | `alx block resolve --chain base` only; see [Optional Base reads](on-chain-base.md#optional-base-reads-reference) |

Block validation never depends on chain availability. See [`on-chain-base.md`](on-chain-base.md).

Reference retrieval server environment (writes optional, reads open by default):

| Variable | Purpose |
| --- | --- |
| `ALX_RETRIEVAL_API_KEY` | Require Bearer or `X-ALX-API-Key` on `POST /block` and `POST /blocks` |
| `ALX_RETRIEVAL_RATE_LIMIT` | Max requests per client IP per window (default `120`) |
| `ALX_RETRIEVAL_RATE_WINDOW_MS` | Window length in ms (default `60000`) |

TLS and high availability are deployment concerns (reverse proxy, load balancer), outside protocol core.

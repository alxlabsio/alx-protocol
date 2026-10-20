# Blocks And Storage

This document explains storage boundaries around ALX Blocks. This document leaves core Block identity to the protocol specification.

ALX Protocol defines Blocks as protocol objects. Storage is explicitly outside the protocol boundary.

---

## Core Principle

**Storage location does not affect Block validity.** A valid Block satisfies the canonical shape and version rules, parent normalization requirements, and both identity checks defined by the specification.

This holds whether the Block lives in a content-addressed storage system, a database, a filesystem, an object store, Git, chain-indexed storage, or memory. The protocol MUST NOT require any specific storage backend.

---

## Protocol Core Scope

| Concern | Protocol role |
|---|---|
| Block identity | Derived from content + parents via keccak-256 |
| Block integrity | Verifiable by recomputing `contentHash` and `blockHash` and applying structural rules |
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
- Block validation checks parent identity format, duplicates, and self-reference where applicable; Graph verification checks reachable cycles and parent availability within its context
- Resolution is an application-level concern

---

## Common Storage Patterns

### Content-Addressed Storage
Blocks map naturally to content-addressed storage because both use content-addressing. A block's `blockHash` can serve as a lookup key, though the hash algorithms differ (keccak-256 versus content-derived identifier v1). Applications typically maintain a mapping between `blockHash` and a content-derived storage identifier. For guaranteed long-term persistence, pin Blocks to pinning storage providers. ALX validates identically in any storage system.

### Databases
Blocks are JSON objects. Store Blocks in any database with `blockHash` as the primary key. Preserve `blockHash`, `contentHash`, `parentHashes`, `content`, and `protocolVersion` when reconstructing a Block.

### Filesystems
One file per Block, named by hash: `0xabc123...def.block.json`.

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
import { createBlock, parseStrictJson, validateBlock } from "@alx-protocol/sdk";

const block = createBlock({ type: "test", value: 42 }, []);

// Store as JSON file
writeFileSync(`${block.blockHash}.json`, JSON.stringify(block));

// Retrieve and validate
const raw = readFileSync(`${block.blockHash}.json`, "utf-8");
const retrieved = parseStrictJson(raw);
console.log(validateBlock(retrieved)); // { ok: true, ... }
```

### PostgreSQL

```javascript
import { createBlock, validateBlock } from "@alx-protocol/sdk";

const block = createBlock({ type: "test", value: 42 }, []);

// Store
await db.query(
  `INSERT INTO blocks (block_hash, content_hash, parent_hashes, content, protocol_version)
   VALUES ($1, $2, $3, $4, $5)`,
  [block.blockHash, block.contentHash, JSON.stringify(block.parentHashes), JSON.stringify(block.content), block.protocolVersion]
);

// Retrieve and validate
const row = await db.query(`SELECT * FROM blocks WHERE block_hash = $1`, [block.blockHash]);
const retrieved = {
  blockHash: row.block_hash,
  contentHash: row.content_hash,
  parentHashes: JSON.parse(row.parent_hashes),
  content: JSON.parse(row.content),
  protocolVersion: row.protocol_version,
};
console.log(validateBlock(retrieved)); // { ok: true, ... }
```

### Content-Addressed Storage

```javascript
import { createBlock, parseStrictJson, validateBlock } from "@alx-protocol/sdk";

const block = createBlock({ type: "test", value: 42 }, []);

// storageClient is a content-addressed storage client
// Pin to content-addressed storage
const cid = await storageClient.add(JSON.stringify(block));
// Note: content-derived storage identifier != blockHash. Maintain a mapping if needed.

// Retrieve and validate
const raw = await storageClient.cat(cid);
const retrieved = parseStrictJson(raw);
console.log(validateBlock(retrieved)); // { ok: true, ... }
```

All four produce `{ ok: true }`. The storage backend is irrelevant to validity.

---

## Recommended Adapter Interface

Applications that need pluggable local storage can use `@alx-protocol/adapters` or implement its `BlockStore` interface:

```typescript
interface BlockStore {
  put(block: Block): Promise<void>;
  get(blockHash: string): Promise<Block | null>;
  list(): Promise<BlockSummary[]>;
  has(blockHash: string): Promise<boolean>;
  remove(blockHash: string): Promise<void>;
}
```

The package provides `MemoryBlockStore` for ephemeral processes, `BrowserBlockStore` backed by IndexedDB, and `FileBlockStore` for local files. A database-backed application can implement the same interface around its chosen database.

Storage writes change local availability while preserving Block identity. Store listings report local availability only; `parentHashes` define Graph relationships.

See [`../../adapters/README.md`](../../adapters/README.md) for package usage.

---

## Anti-Patterns

- **Storing blocks only in a specific system** and treating that system as the source of truth. The hash is the source of truth, independent of storage location.
- **Requiring a specific storage backend for protocol operation.** If an implementation fails when the storage backend changes, the implementation couples protocol logic to storage.
- **Using storage-layer identifiers (content-derived storage identifiers, database row IDs) as block identity.** Block identity is always `blockHash` — derived from content and parents, independent of storage system.

---

## IPFS Integration

IPFS is a recommended storage backend for Blocks that need decentralized availability. ALX and IPFS share the content-addressing principle but use different hash functions — complementary primitives, each with distinct identity schemes.

### `blockHash` And CID

| Property | ALX `blockHash` | IPFS CID |
|---|---|---|
| Hash function | Keccak-256 | SHA-256 (multihash) |
| Input | `canonicalize({ content, parentHashes })` | Raw file bytes |
| Format | `0x` + 64 hex chars | `bafybei...` (base32 CIDv1) |
| Verifiable by | ALX SDK (`validateBlock`) | IPFS protocol |

The identifiers differ. A Block pinned to IPFS carries a `blockHash` (for ALX protocol verification) and a CID (for IPFS retrieval). Applications MUST maintain a blockHash-to-CID mapping.

### Publishing a Block to IPFS

```bash
# Pin a Block to a local Kubo node and record the CID mapping
alx block publish research.block.json --ipfs http://localhost:5001

# Output:
#   ✓ Pinned to IPFS
#     CID:      bafybeihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku
#     Gateway:  https://ipfs.io/ipfs/bafybei...
#     CID map:  updated ~/.alx/cid-map.json
```

The local CID map (`~/.alx/cid-map.json`) stores the `blockHash → CID` mapping. `alx block resolve` uses the application-owned cache to look up a CID and fetch through the configured gateway. Local Block Stores persist complete Blocks, while public discovery belongs to network services.

### Resolving a Block by blockHash

```bash
# Resolve using the local CID map and default IPFS gateway
alx block resolve 0xabc123...

# Use a custom gateway or a direct HTTP endpoint
alx block resolve 0xabc123... --gateway https://dweb.link/ipfs
alx block resolve 0xabc123... --endpoint https://api.myservice.com

# Machine-readable output
alx block resolve 0xabc123... --json
```

Resolution order:
1. HTTP retrieval endpoint (`GET /block/{blockHash}`) if `--endpoint` appears in the call
2. Local CID map (`~/.alx/cid-map.json`) → IPFS gateway

The CLI verifies every fetched Block against the requested `blockHash` before returning the Block. Local recomputation is required; fetching from a trusted source is insufficient alone.

### Programmatic resolution

```javascript
import { resolveBlock, publishToIpfs, recordCidMapping } from "@alx-protocol/cli/lib/resolve.js";

// Publish a Block to a Kubo node
const cid = await publishToIpfs(block, "http://localhost:5001");
recordCidMapping(block.blockHash, cid, "ipfs");

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

### CID map format

`~/.alx/cid-map.json` stores the application-local mapping between ALX block hashes and IPFS CIDs:

```json
{
  "version": "1",
  "mappings": {
    "0xabc123...": {
      "cid": "bafybeihdwdcefgh4...",
      "source": "ipfs",
      "recordedAt": "2026-05-30T12:00:00.000Z"
    }
  }
}
```

A custom CID-map path can be specified with `--cid-map <path>` on any `alx block publish` or `alx block resolve` call.

### Pinning services

Kubo is optional. Any IPFS pinning service that exposes a Kubo-compatible HTTP API works:

| Service | Endpoint |
|---|---|
| Local Kubo node | `http://localhost:5001` |
| Pinata | `https://api.pinata.cloud` (with API key auth) |
| web3.storage | `https://api.web3.storage` |
| Infura IPFS | `https://ipfs.infura.io:5001` |

For services that require authentication, set the appropriate authorization headers in a proxy or use the service's SDK before passing the CID to `recordCidMapping`.

### Retrieval API

The `protocol/retrieval-api.yaml` specification defines a standard HTTP interface for Block storage and retrieval:

```
GET  /block/{blockHash}    → Block | 404
POST /block                → { blockHash, cid? } | 400
HEAD /block/{blockHash}    → 200 | 404
POST /blocks               → { blocks, missing }
GET  /block/{blockHash}/cid → { blockHash, cid, gatewayUrl }
```

The advisory, non-normative API is available through `alx retrieval start` on port 8081, separate from the verification API on port 8080. The reference service supports controlled team networks. Production multi-party discovery belongs to separately specified application infrastructure.

### Team resolution (shared retrieval server)

For multi-developer use before an on-chain anchor exists, run a shared retrieval server instead of relying on per-machine `~/.alx/cid-map.json` files:

```bash
# Alice — host the shared store
alx retrieval start --port 8081 --data-dir ./team-retrieval

# Alice — publish Block bytes and optional CID metadata
alx block publish research.block.json \
  --endpoint http://alice:8081 \
  --ipfs http://localhost:5001

# Bob — resolve by blockHash only (no local CID map required)
alx block resolve 0xabc123... --endpoint http://alice:8081
```

The retrieval server validates Blocks on write (`validateBlock`), and clients re-verify `blockHash` after fetch. The pattern suits controlled team networks such as localhost, VPN, and staging environments.

Reference-only publish envelope (informative): the reference server also accepts `{ "block": { ... }, "cid": "bafy..." }` on `POST /block` so IPFS CIDs can be indexed for `GET /block/{blockHash}/cid`. The OpenAPI spec documents this as `PublishBlockRequest` in [`protocol/retrieval-api.yaml`](../../protocol/retrieval-api.yaml) (also published at `https://alxprotocol.com/protocol/1/retrieval-api.yaml`).

### Resolution Layers

Default integration uses no blockchain:

1. A Local Block Store persists application-owned Blocks.
2. IPFS or another storage provider makes bytes available.
3. `alx retrieval start` exposes a controlled team endpoint.
4. Separately specified application infrastructure handles public discovery when implemented.

| Layer | Default? | Role |
|---|---|---|
| Local Block Store | Yes | Application persistence |
| Retrieval API | Optional | Controlled team fetch and publish |
| Application discovery service | External | Cross-party discovery |
| ALXAnchor | No | Rare public existence-time evidence for one hash or transaction batch |

Block validation never depends on storage, discovery, or chain availability. See [`on-chain-base.md`](on-chain-base.md).

Reference retrieval server environment (writes optional, reads open by default):

| Variable | Purpose |
| --- | --- |
| `ALX_RETRIEVAL_API_KEY` | Require Bearer or `X-ALX-API-Key` on `POST /block` and `POST /blocks` |
| `ALX_RETRIEVAL_RATE_LIMIT` | Max requests per client IP per window (default `120`) |
| `ALX_RETRIEVAL_RATE_WINDOW_MS` | Window length in ms (default `60000`) |

TLS and high availability are deployment concerns (reverse proxy, load balancer), outside protocol core.

## Related Documents

- [Protocol specification](../../protocol/spec.md)
- [Block storage adapters](./block-storage-adapters.md)

# Registry Blocks

Audience: Integrators, platform operators, Xandr Labs product teams  

Registry Blocks are ordinary ALX Blocks whose `content` describes a **catalog** of other Blocks (and optional storage pointers). The same `blockHash`, `parentHashes`, and `validateBlock` rules apply as with any other Block. The core protocol applies no special treatment — the `alx.registry` type is a **convention** for humans and tooling.

---

## Purpose

Explain how ALX and adopters publish discoverable catalogs without replacing the Block primitive or requiring a single monolithic on-chain contract for all product metadata.

## Registry Block Benefits

Registry Blocks are the **default discovery layer**—no **ALX anchor**, wallet, or RPC. (An ALX **blockchain** means linked Blocks via `parentHashes`; see [glossary.md](glossary.md).)

| Mechanism | Question | Chain? |
|-----------|----------|--------|
| **Registry Block** (`alx.registry`) | Steward/platform **catalog** (products, platforms) | No |
| **Index Block** (`alx.index`) | Which `blockHash` values are available/approved on a platform? | No |
| **Ordinary Blocks** | What is this artifact, and what are its parents? | No |
| **IPFS / retrieval / local registry** | Where are the bytes for this `blockHash`? | No |
| **ALX anchor** ([`on-chain-base.md`](on-chain-base.md)) | Neutral on-chain existence-time for a `blockHash` or blockset? | Optional, rare |

Adopters SHOULD use Blocks, **`alx.index`**, and **`alx.registry`** for catalogs and trust. See [`index-blocks.md`](index-blocks.md). On-chain use is limited to **ALXAnchor** when a public timestamp is required.

---

## ALX canonical registry (one catalog Block)

Xandr Labs SHOULD maintain **one evolving catalog** at the protocol/product layer:

1. Create a Block with `content.type: "alx.registry"` listing canonical entries (spec anchors, sample packages, product Blocks, documentation pointers). Include `cid` per entry when pinned.
2. Distribute the catalog Block JSON and CIDs via IPFS, `alx block publish`, team retrieval server, or checked-in references—**no on-chain step required**.
3. When a new Xandr product ships, **commit a new registry Block** with `parentHashes` pointing at the previous catalog Block.
4. **Optional:** `alx anchor` on Base only when a neutral on-chain timestamp is required (see [on-chain-base.md](on-chain-base.md)).

```javascript
import { createBlock } from "@alx-protocol/sdk";
import { buildRegistryBlockContent } from "@alx-protocol/cli/lib/registry-block.js";

const previousCatalogHash = "0x..."; // prior alx.registry blockHash

const content = buildRegistryBlockContent("xandrlabs", [
  {
    role: "product",
    label: "Market synthesis artifact package",
    blockHash: "0x...",
    cid: "bafybei...",
  },
  {
    role: "documentation",
    label: "Integrator storage guide",
    uri: "https://github.com/xandrlabs/alx-protocol/blob/main/docs/integrators/storage.md",
  },
]);

const registryBlock = createBlock(content, [previousCatalogHash]);
```

Set `ALX_CANONICAL_REGISTRY_BLOCK_HASH` (see [`protocol/chains/base-mainnet.json`](../../protocol/chains/base-mainnet.json)) to the latest catalog `blockHash` when operating CLI or services that need a default root.

---

## Adopter platform registry (optional)

Any organization adopting ALX MAY publish its own `alx.registry` Block:

- `content.issuer` identifies the platform (for example `acme-agent-platform`).
- `entries` list that platform’s Blocks, registry sub-catalogs, or policies.
- `parentHashes` MAY include the ALX canonical registry Block hash to show lineage from the ecosystem root.

```javascript
const acmeRegistry = createBlock(
  {
    type: "alx.registry",
    version: "1",
    issuer: "acme-agent-platform",
    entries: [
      { role: "platform-policy", blockHash: "0x...", label: "Agent response policy v2" },
      { role: "product", blockHash: "0x...", cid: "bafybei...", label: "Security review workflow bundle" },
    ],
  },
  [alxCanonicalRegistryBlockHash],
);
```

Each product release or major catalog update is a **new Block** — mutation of an existing Block is structurally invalid. Clients choose which catalog `blockHash` to trust (latest ALX catalog, Acme catalog, or both via lineage).

---

## Informative `content` shape

| Field | Required | Description |
|-------|----------|-------------|
| `type` | Yes | Must be `alx.registry` |
| `version` | Yes | Convention version (for example `"1"`) |
| `issuer` | Yes | Platform or steward id (for example `xandrlabs`) |
| `entries` | Yes | Array of catalog entries |
| `entries[].role` | Yes | `product`, `platform`, `documentation`, `canonical-registry`, etc. |
| `entries[].blockHash` | Optional | Referenced Block |
| `entries[].cid` | Optional | IPFS CID for pinned Block JSON |
| `entries[].label` | Optional | Human-readable title |
| `entries[].uri` | Optional | Non-IPFS URL |

Validate shape locally with `validateRegistryBlockContent` from [`cli/lib/registry-block.js`](../../cli/lib/registry-block.js) before locking.

---

## Relationship to Solidity contracts

Registry Blocks are **off-chain protocol objects**. The default path uses no Solidity ([`on-chain-base.md`](on-chain-base.md)):

- Catalogs and platform approval live in **`alx.registry`** and **`alx.index`** Blocks.
- **ALXAnchor** on Base is optional and records existence-time only — catalog rows stay off-chain.

Never store catalogs on-chain.

---

## Blockchains and blocksets

Product vocabulary (informative): a **blockchain** (one word) is 2+ Blocks linked by `parentHashes`; a **blockset** (one word) is 2+ `blockHash` values grouped for one release or anchor. Registry catalog chains are **blockchains**; each `entries` slice for a release may be described as a **blockset**. See [`glossary.md`](glossary.md).

---

## Related Documents

- [`index-blocks.md`](index-blocks.md) — off-chain `alx.index` trust inclusion
- [`glossary.md`](glossary.md) — blockchain, blockset, and normative term map
- [`on-chain-base.md`](on-chain-base.md) — Base mainnet contracts and target architecture
- [`storage.md`](storage.md) — IPFS, retrieval API, resolution order
- [`protocol/spec.md`](../../protocol/spec.md) — normative Block rules
- [`../../contracts/README.md`](../../contracts/README.md) — reference ABIs

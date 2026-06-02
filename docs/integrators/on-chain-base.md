# ALX anchor (Base Mainnet)

Audience: Integrators, DevOps, Xandr Labs operators  

**ALX anchor** is the optional on-chain surface on Base (**ALXAnchor** contract). Block creation, validation, **blockchain** lineage, **`alx.index`**, and **`alx.registry`** all operate without a wallet, gas, or RPC.

---

## Purpose

Document **ALXAnchor** on Base versus off-chain conventions. New integrators need only this contract for on-chain writes. Historical Base deployments are listed in [Legacy on Base (reference only)](#legacy-on-base-reference-only).

## ALX vocabulary (informative)

| Term | Layer |
|------|--------|
| **Block** | Protocol primitive |
| **blockchain** | Off-chain — 2+ Blocks linked via `parentHashes` |
| **blockset** | Off-chain — 2+ `blockHash` values grouped for one operation |
| **`alx.index`** | Off-chain — platform available / approved hashes |
| **`alx.registry`** | Off-chain — steward / platform catalog |
| **ALX anchor** | On-chain — **ALXAnchor** on Base (existence-time, optional blockset commit) |

Catalogs and indexes stay off-chain. The anchor layer label applies only to **ALXAnchor**, never to off-chain linked Blocks.

---

## Minimal ALX anchor use (recommended)

| Activity | ALX anchor? |
|----------|-------------|
| `createBlock`, `validateBlock`, `traceAttribution` | No |
| Platform **`alx.index`** / **`alx.registry`** | No |
| Trust = `validateBlock` + **`alx.index`** membership | No |
| Public existence-time for a `blockHash` or **blockset** | **Yes** — **ALXAnchor** |

**Default:** platforms publish **`alx.index`** Blocks; consumers run `validateBlock` and check index membership. **ALX anchor** only when a neutral on-chain timestamp is worth the gas.

```text
Off-chain (default):
  Block → blockchain → blockset → alx.index (+ optional alx.registry)
  trust: validateBlock + alx.index membership

ALX anchor (rare):
  blockHash or blockset → ALXAnchor on Base
```

---

## ALXAnchor (target contract)

Source: [`contracts/ALXAnchor.sol`](../../contracts/ALXAnchor.sol). ABI: [`contracts/abis/ALXAnchor.json`](../../contracts/abis/ALXAnchor.json). Address after deploy: [`protocol/chains/base-mainnet.json`](../../protocol/chains/base-mainnet.json) → `contracts.alxAnchor.address`.

| Function | Role |
|----------|------|
| `anchor(bytes32)` | First existence-time for one `blockHash`; reverts if already anchored |
| `anchorBlockSet(bytes32 setId, bytes32[])` | Batch anchor; **minimum 2** hashes; skips already-anchored entries |
| `isAnchored(bytes32)` | Read-only check |
| `anchoredAt` / `anchoredBy` | Timestamp and submitter of first anchor |

`setId` is for events and application narrative; membership lists belong in **`alx.index`** off-chain.

Deploy and verify: [`contracts/README.md`](../../contracts/README.md).

---

## CLI (opt-in)

```bash
# Anchor a Block (validateBlock runs locally first)
alx anchor create path/to/block.json --rpc-url https://sepolia.base.org --private-key <key>

# Anchor a blockset (minimum 2 comma-separated blockHashes)
alx anchor create --blockset 0xaaa...,0xbbb... --rpc-url https://sepolia.base.org --private-key <key>

# Query anchor status (read-only, no private key)
alx anchor status 0x<blockHash> --rpc-url https://sepolia.base.org --json

# Optional: resolve Block bytes via configured Base pointer read (see below)
alx block resolve 0x<blockHash> --chain base --rpc-url https://mainnet.base.org
```

No RPC unless `--chain base`, `alx anchor`, or `alx anchor status` is used.

| Variable | Purpose |
|----------|---------|
| `ALX_ANCHOR_ADDRESS` | ALXAnchor address override |
| `ALX_BASE_RPC_URL` | Base RPC endpoint |
| `ALX_DEPLOY_KEY` | Hex private key for anchor transactions (never commit) |
| `ALX_POINTER_REGISTRY_ADDRESS` | Optional read-only CID pointer override (`base-mainnet.json`) |

---

## Optional Base reads (reference)

**New integrations use only ALXAnchor for on-chain writes.**

`alx block resolve --chain base` may consult an optional read-only CID pointer address in [`protocol/chains/base-mainnet.json`](../../protocol/chains/base-mainnet.json) together with **ALXAnchor** metadata. Historical marketplace or checkpoint deployments on Base are out of scope for new work; Merkle proofs and platform ACL remain off-chain (`alx.index`, SDK).

Contract engineer reference (ABIs and legacy deployment names): [`contracts/README.md`](../../contracts/README.md) only.

---

## Related Documents

- [`glossary.md`](glossary.md) — full term map
- [`index-blocks.md`](index-blocks.md) — `alx.index`
- [`registry-blocks.md`](registry-blocks.md) — `alx.registry`
- [`storage.md`](storage.md) — IPFS and retrieval API

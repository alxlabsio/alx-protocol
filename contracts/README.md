# ALXAnchor Reference Contract

- **Status:** Implemented, not deployed
- **Audience:** Contract engineers and Base integrators
- **Authority:** Non-normative optional integration; protocol behavior remains governed by [`../protocol/spec.md`](../protocol/spec.md)
- **Last reviewed:** 2026-08-03

`ALXAnchor` records existence-time metadata for individual `blockHash` values or a transaction batch. It is permissionless and has no administrator or upgrade mechanism. Default ALX integrations use local verification and off-chain storage without this contract.

## Build And Test

```bash
cd contracts
npm install
npm run compile
npm test
```

## Deploy

```bash
# Base Sepolia
ALX_BASE_SEPOLIA_RPC_URL=https://sepolia.base.org ALX_DEPLOY_KEY=<hex-key> npm run deploy:sepolia

# Base mainnet, after review and audit
ALX_BASE_RPC_URL=https://mainnet.base.org ALX_DEPLOY_KEY=<hex-key> npm run deploy:mainnet
```

## CLI Usage

```bash
# Anchor one validated Block
alx anchor create path/to/block.json --rpc-url https://sepolia.base.org --private-key <key>

# Anchor a transaction batch of blockHash values
alx anchor create --hashes 0xaaa...,0xbbb... --batch-id 0xccc... --rpc-url https://sepolia.base.org --private-key <key>

# Query one blockHash
alx anchor status 0xaaa... --rpc-url https://sepolia.base.org --json
```

## Contract Surface

| Item | Description |
|---|---|
| `anchor(bytes32)` | Anchor one `blockHash`; reverts `AlreadyAnchored` on duplicate |
| `anchorBatch(bytes32, bytes32[])` | Anchor at least two hashes; skips duplicates and limits a batch to 256 entries |
| `isAnchored(bytes32)` | Return whether a hash was anchored |
| `anchoredAt(bytes32)` | Return the timestamp of the first anchor |
| `anchoredBy(bytes32)` | Return the address that first anchored the hash |
| `Anchored` | Event emitted for each new hash |
| `BatchAnchored` | Event emitted once per transaction batch |

Source: [`ALXAnchor.sol`](./src/ALXAnchor.sol). ABI: [`abis/ALXAnchor.json`](./abis/ALXAnchor.json).


## Related Documents

- [`docs/integrators/on-chain-base.md`](../docs/integrators/on-chain-base.md)
- [`docs/decisions/008-storage-and-discovery-boundaries.md`](../docs/decisions/008-storage-and-discovery-boundaries.md)
- [`protocol/chains/base-mainnet.json`](../protocol/chains/base-mainnet.json)

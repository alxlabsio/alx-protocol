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

Deployment is fail-closed. The script verifies the configured network and chain ID,
requires a funded signer, waits for the configured receipt confirmations, compares
the deployed runtime bytecode with the compiled artifact, checks
`MAX_BATCH_SIZE`, and updates only that network's deployment record.

```bash
# Base Sepolia
pnpm run deploy:sepolia

# Base mainnet, after independent review and audit
pnpm run deploy:mainnet
```

Configure secrets and endpoints outside repository files:

| Variable | Requirement |
|---|---|
| `ALX_DEPLOY_KEY` | Dedicated funded deployment key; never commit or print it |
| `ALX_BASE_SEPOLIA_RPC_URL` | Base Sepolia endpoint |
| `ALX_BASE_RPC_URL` | Dedicated Base mainnet production endpoint; the public Base endpoint is rejected for deployment |
| `BASESCAN_API_KEY` | Required before mainnet deployment so source verification can follow immediately |
| `ALX_DEPLOY_CONFIRMATIONS` | Optional positive receipt-confirmation count; defaults to 2 on Sepolia and 5 on mainnet |
| `ALX_CONFIRM_MAINNET_DEPLOY` | For mainnet, exactly `base-mainnet:8453:ALXAnchor` |

Mainnet additionally requires a clean Git worktree and index. After the script
verifies the runtime bytecode and records the deployment, verify the source:

```bash
pnpm run verify:sepolia -- 0x<address>
pnpm run verify:mainnet -- 0x<address>
```

The deployment script does not mark the integration lifecycle active and does
not change the default CLI network. Those publication decisions require a
separate reviewed repository change.

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
Deployment records: [`protocol/chains/base-mainnet.json`](../protocol/chains/base-mainnet.json).


## Related Documents

- [`docs/integrators/on-chain-base.md`](../docs/integrators/on-chain-base.md)
- [`docs/governance/independent-security-review-plan.md`](../docs/governance/independent-security-review-plan.md)
- [`docs/decisions/008-storage-and-discovery-boundaries.md`](../docs/decisions/008-storage-and-discovery-boundaries.md)
- [`protocol/chains/base-mainnet.json`](../protocol/chains/base-mainnet.json)

# Optional Base Anchoring

- **Status:** Planned optional integration
- **Audience:** Integrators requiring public existence-time evidence
- **Authority:** Non-normative; protocol behavior remains governed by [`../../protocol/spec.md`](../../protocol/spec.md)
- **Last reviewed:** 2026-08-03

The `ALXAnchor` optional Base contract records when a `blockHash` first appeared on-chain. Block creation, validation, Graph construction, storage, and retrieval operate independently of wallets, gas, RPC endpoints, and contracts.

## When To Use It

Use `ALXAnchor` when a neutral public timestamp justifies the operational cost. `ALXAnchor` records hashes and timestamps only. Applications retain content storage, location resolution, authorship, Block validation, and availability responsibilities.

| Need | Contract required? |
|---|---|
| Create or validate a Block | No |
| Store or retrieve a Block | No |
| Build or verify a Graph | No |
| Record public existence-time for one hash | Optional |
| Submit several hashes in one transaction | Optional |

## Contract Surface

| Function | Purpose |
|---|---|
| `anchor(bytes32 blockHash)` | Record one previously unanchored hash |
| `anchorBatch(bytes32 batchId, bytes32[] blockHashes)` | Submit 2–256 hashes in one transaction; already anchored hashes are skipped |
| `isAnchored(bytes32 blockHash)` | Check whether a hash has an anchor |
| `anchoredAt(bytes32 blockHash)` | Return the first anchor timestamp |
| `anchoredBy(bytes32 blockHash)` | Return the submitting address |

`batchId` identifies the transaction batch for event consumers. Portable membership uses application-owned data. Anchoring preserves the existing Block set and Graph.

## CLI

```bash
# Anchor one locally validated Block
alx anchor create research.block.json \
  --rpc-url https://sepolia.base.org \
  --private-key <key>

# Submit several blockHash values in one transaction
alx anchor create --hashes 0xaaa...,0xbbb... \
  --batch-id 0xccc... \
  --rpc-url https://sepolia.base.org \
  --private-key <key>

# Query one blockHash
alx anchor status 0x<blockHash> \
  --rpc-url https://sepolia.base.org \
  --json
```

Environment variables:

| Variable | Purpose |
|---|---|
| `ALX_ANCHOR_ADDRESS` | Override the configured contract address |
| `ALX_BASE_SEPOLIA_RPC_URL` | Base Sepolia RPC endpoint |
| `ALX_BASE_RPC_URL` | Base mainnet RPC endpoint |
| `ALX_DEPLOY_KEY` | Transaction-signing private key; never commit it |

Deployment state is declared in [`../../protocol/chains/base-mainnet.json`](../../protocol/chains/base-mainnet.json). The configured deployment remains planned until an address is published through the repository release process.

## Security Boundary

Clients validate Blocks locally before anchoring and again after retrieval. Signature material, contract metadata, timestamps, and transaction identifiers remain outside `blockHash` derivation. Contract unavailability never changes Block identity or validity.

## Related Documents

- [`../../contracts/README.md`](../../contracts/README.md)
- [`storage.md`](./storage.md)
- [`../decisions/008-storage-and-discovery-boundaries.md`](../decisions/008-storage-and-discovery-boundaries.md)
- [`../../protocol/spec.md`](../../protocol/spec.md)

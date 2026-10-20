/**
 * ALXAnchor transaction helpers.
 *
 * Submits anchor() and anchorBatch() transactions to ALXAnchor on Base.
 * Contract address: protocol/chains/base-mainnet.json → contracts.anchor.deployments
 * ABI: contracts/abis/ALXAnchor.json
 *
 * Environment variables (process.env fallback when opts omit the value):
 *   ALX_BASE_SEPOLIA_RPC_URL — Base Sepolia RPC endpoint
 *   ALX_DEPLOY_KEY     — Hex private key for signing transactions
 *   ALX_ANCHOR_ADDRESS — Override the selected network's contract address
 *   ALX_ANCHOR_ADDRESS_BASE_SEPOLIA — Configured Base Sepolia override
 *   ALX_ANCHOR_ADDRESS_BASE_MAINNET — Configured Base mainnet override
 */

import { ethers } from "ethers";
import {
  loadAnchorAbi,
  loadBaseMainnetConfig,
  resolveContractAddress,
  resolveContractNetwork,
  resolveNetwork,
  resolveRpcUrl,
} from "./base-contracts.js";


/** Application batch ceiling matching the v1 parent-count maximum. */
export const MAX_BATCH_SIZE = 256;

const BATCH_ANCHORED_TOPIC = ethers.id(
  "BatchAnchored(bytes32,address,uint256,uint256)",
);

function resolveAddress(opts) {
  const override = opts.address || process.env.ALX_ANCHOR_ADDRESS;
  if (override) return override;
  const config = loadBaseMainnetConfig();
  const address = resolveContractAddress(config, "anchor");
  if (!address) {
    throw new Error(
      "ALXAnchor address not set in protocol/chains/base-mainnet.json. " +
      "Deploy first: cd contracts && npm run deploy:sepolia",
    );
  }
  return address;
}

function resolveAnchorNetwork(config) {
  const networkId = resolveContractNetwork(config, "anchor");
  const network = resolveNetwork(config, networkId);
  if (!network || !Number.isInteger(network.chainId) || network.chainId <= 0) {
    throw new Error("Invalid anchor deployment network in base-mainnet.json");
  }
  return { networkId, network };
}

function buildProvider(opts) {
  const config = loadBaseMainnetConfig();
  const { networkId, network } = resolveAnchorNetwork(config);
  const url = opts.rpcUrl || resolveRpcUrl(config, networkId);
  if (!url) {
    throw new Error(`RPC URL required for ${networkId}. Set ${network.rpcUrlEnv} or pass --rpc-url.`);
  }
  return new ethers.JsonRpcProvider(url, network.chainId);
}

async function assertProviderChain(provider, expectedChainId) {
  const network = await provider.getNetwork();
  const actual = Number(network.chainId);
  if (actual !== expectedChainId) {
    throw new Error(
      `RPC chainId mismatch: expected ${expectedChainId} (Base), got ${actual}. Check --rpc-url.`,
    );
  }
}

function buildSigner(provider, opts) {
  const key = opts.privateKey || process.env.ALX_DEPLOY_KEY;
  if (!key) throw new Error("Private key required. Set ALX_DEPLOY_KEY or pass --private-key");
  return new ethers.Wallet(key, provider);
}

function buildContract(signerOrProvider, opts) {
  return new ethers.Contract(resolveAddress(opts), loadAnchorAbi(), signerOrProvider);
}

/**
 * Parse newlyAnchored count from BatchAnchored log (falls back to 0).
 * @param {import("ethers").ContractTransactionReceipt} receipt
 * @returns {number}
 */
function parseBatchAnchoredCount(receipt) {
  const iface = new ethers.Interface(loadAnchorAbi());
  for (const log of receipt.logs) {
    if (log.topics[0] !== BATCH_ANCHORED_TOPIC) continue;
    try {
      const parsed = iface.parseLog({ topics: log.topics, data: log.data });
      if (parsed?.name === "BatchAnchored") {
        return Number(parsed.args.count);
      }
    } catch {
      // try next log
    }
  }
  return 0;
}

/**
 * Anchor a single blockHash on Base.
 * @param {string} blockHash - 0x-prefixed 64-char hex string
 * @param {{ rpcUrl?, privateKey?, address? }} opts
 * @returns {Promise<{ txHash, blockHash, anchoredAt }>}
 */
export async function anchorBlock(blockHash, opts = {}) {
  const config = loadBaseMainnetConfig();
  const provider = buildProvider(opts);
  const { network } = resolveAnchorNetwork(config);
  await assertProviderChain(provider, network.chainId);
  const signer = buildSigner(provider, opts);
  const contract = buildContract(signer, opts);

  const tx = await contract.anchor(blockHash);
  const receipt = await tx.wait();
  const block = await provider.getBlock(receipt.blockNumber);

  return {
    txHash: receipt.hash,
    blockHash,
    anchoredAt: block.timestamp,
  };
}

/**
 * Anchor a batch (minimum 2 hashes) on Base.
 * The contract skips already-anchored hashes; count is newly anchored only.
 * @param {string} batchId - 0x-prefixed 64-char hex batchId
 * @param {string[]} blockHashes - Array of 0x-prefixed blockHashes (minimum 2, max 256)
 * @param {{ rpcUrl?, privateKey?, address? }} opts
 * @returns {Promise<{ txHash, batchId, count, anchoredAt }>}
 */
export async function anchorBatch(batchId, blockHashes, opts = {}) {
  if (blockHashes.length < 2) {
    throw new Error(`batch requires at least 2 hashes; received ${blockHashes.length}`);
  }
  if (blockHashes.length > MAX_BATCH_SIZE) {
    throw new Error(`batch exceeds maximum of ${MAX_BATCH_SIZE} hashes`);
  }

  const config = loadBaseMainnetConfig();
  const provider = buildProvider(opts);
  const { network } = resolveAnchorNetwork(config);
  await assertProviderChain(provider, network.chainId);
  const signer = buildSigner(provider, opts);
  const contract = buildContract(signer, opts);

  const tx = await contract.anchorBatch(batchId, blockHashes);
  const receipt = await tx.wait();
  const block = await provider.getBlock(receipt.blockNumber);
  const count = parseBatchAnchoredCount(receipt);

  return {
    txHash: receipt.hash,
    batchId,
    count,
    anchoredAt: block.timestamp,
  };
}

/**
 * Derive a deterministic batchId from a list of blockHashes.
 * Produces keccak256(concat(sorted blockHashes)) — consistent with Solidity abi.encodePacked.
 * @param {string[]} blockHashes
 * @returns {string} 0x-prefixed 64-char hex batchId
 */
export function deriveBatchId(blockHashes) {
  const sorted = [...blockHashes].map(h => h.toLowerCase()).sort();
  return ethers.keccak256(ethers.concat(sorted.map(h => ethers.getBytes(h))));
}

/**
 * Query anchor status for a blockHash (read-only).
 * @param {string} blockHash - 0x-prefixed 64-char hex string
 * @param {{ rpcUrl?, address? }} opts
 * @returns {Promise<{ blockHash, anchoredAt, anchoredBy, isAnchored }>}
 */
export async function queryAnchor(blockHash, opts = {}) {
  const config = loadBaseMainnetConfig();
  const provider = buildProvider(opts);
  const { network } = resolveAnchorNetwork(config);
  await assertProviderChain(provider, network.chainId);
  const contract = buildContract(provider, opts);

  const [ts, by] = await Promise.all([
    contract.anchoredAt(blockHash),
    contract.anchoredBy(blockHash),
  ]);

  return {
    blockHash,
    anchoredAt: Number(ts),
    anchoredBy: by,
    isAnchored: Number(ts) !== 0,
  };
}

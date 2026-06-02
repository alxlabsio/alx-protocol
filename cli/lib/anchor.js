/**
 * ALXAnchor transaction helpers.
 *
 * Submits anchor() and anchorBlockSet() transactions to ALXAnchor on Base.
 * Contract address: protocol/chains/base-mainnet.json → contracts.alxAnchor.address
 * ABI: contracts/abis/ALXAnchor.json
 *
 * Environment variables (process.env fallback when opts omit the value):
 *   ALX_BASE_RPC_URL   — Base RPC endpoint
 *   ALX_DEPLOY_KEY     — Hex private key for signing transactions
 *   ALX_ANCHOR_ADDRESS — Override contract address
 */

import { ethers } from "ethers";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadAnchorAbi, loadBaseMainnetConfig } from "./base-contracts.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../..");

/** Aligns with protocol parent limit (LIMIT-001). */
export const MAX_BLOCKSET_SIZE = 256;

const BLOCK_SET_ANCHORED_TOPIC = ethers.id(
  "BlockSetAnchored(bytes32,address,uint256,uint256)",
);

function resolveAddress(opts) {
  const override = opts.address || process.env.ALX_ANCHOR_ADDRESS;
  if (override) return override;
  const config = loadBaseMainnetConfig();
  const address = config.contracts?.alxAnchor?.address;
  if (!address) {
    throw new Error(
      "ALXAnchor address not set in protocol/chains/base-mainnet.json. " +
      "Deploy first: cd contracts && npm run deploy:sepolia",
    );
  }
  return address;
}

function buildProvider(opts) {
  const config = loadBaseMainnetConfig();
  const url = opts.rpcUrl || process.env.ALX_BASE_RPC_URL || config.rpc?.defaultUrl || "https://mainnet.base.org";
  const chainId = config.chainId;
  if (!Number.isInteger(chainId) || chainId <= 0) {
    throw new Error("Invalid chainId in base-mainnet.json");
  }
  return new ethers.JsonRpcProvider(url, chainId);
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
 * Parse newlyAnchored count from BlockSetAnchored log (falls back to 0).
 * @param {import("ethers").ContractTransactionReceipt} receipt
 * @returns {number}
 */
export function parseBlockSetAnchoredCount(receipt) {
  const iface = new ethers.Interface(loadAnchorAbi());
  for (const log of receipt.logs) {
    if (log.topics[0] !== BLOCK_SET_ANCHORED_TOPIC) continue;
    try {
      const parsed = iface.parseLog({ topics: log.topics, data: log.data });
      if (parsed?.name === "BlockSetAnchored") {
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
  await assertProviderChain(provider, config.chainId);
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
 * Anchor a blockset (minimum 2 hashes) on Base.
 * The contract skips already-anchored hashes; count is newly anchored only.
 * @param {string} setId - 0x-prefixed 64-char hex setId
 * @param {string[]} blockHashes - Array of 0x-prefixed blockHashes (minimum 2, max 256)
 * @param {{ rpcUrl?, privateKey?, address? }} opts
 * @returns {Promise<{ txHash, setId, count, anchoredAt }>}
 */
export async function anchorBlockSet(setId, blockHashes, opts = {}) {
  if (blockHashes.length < 2) {
    throw new Error(`blockset requires at least 2 hashes; received ${blockHashes.length}`);
  }
  if (blockHashes.length > MAX_BLOCKSET_SIZE) {
    throw new Error(`blockset exceeds maximum of ${MAX_BLOCKSET_SIZE} hashes`);
  }

  const config = loadBaseMainnetConfig();
  const provider = buildProvider(opts);
  await assertProviderChain(provider, config.chainId);
  const signer = buildSigner(provider, opts);
  const contract = buildContract(signer, opts);

  const tx = await contract.anchorBlockSet(setId, blockHashes);
  const receipt = await tx.wait();
  const block = await provider.getBlock(receipt.blockNumber);
  const count = parseBlockSetAnchoredCount(receipt);

  return {
    txHash: receipt.hash,
    setId,
    count,
    anchoredAt: block.timestamp,
  };
}

/**
 * Derive a deterministic setId from a list of blockHashes.
 * Produces keccak256(concat(sorted blockHashes)) — consistent with Solidity abi.encodePacked.
 * @param {string[]} blockHashes
 * @returns {string} 0x-prefixed 64-char hex setId
 */
export function deriveSetId(blockHashes) {
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
  await assertProviderChain(provider, config.chainId);
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

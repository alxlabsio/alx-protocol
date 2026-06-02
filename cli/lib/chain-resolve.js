/**
 * Resolve blockHash → Block via Base mainnet on-chain layer (optional shell).
 *
 *   pointerRegistry — optional blockHash → IPFS CID read
 *   alxAnchor       — blockHash → { anchoredAt, anchoredBy }
 *
 * resolveBlockFromBase queries both in parallel and merges results.
 */

import {
  loadBaseMainnetConfig,
  loadAnchorAbi,
  resolveContractAddress,
  resolveRpcUrl,
  blockHashToBytes32,
} from "./base-contracts.js";

async function tryReadCid(contract, fragments, blockHash) {
  const hash32 = blockHashToBytes32(blockHash);
  for (const fragment of fragments) {
    const fn = fragment.split("(")[0].replace("function ", "").trim();
    if (!contract[fn]) continue;
    try {
      const cid = await contract[fn](hash32);
      if (typeof cid === "string" && cid.length > 0) return cid;
    } catch {
      // try next fragment
    }
  }
  return null;
}

/**
 * @param {typeof import("ethers")} ethers
 * @param {import("ethers").Provider} provider
 * @param {object} config
 * @param {string} blockHash
 */
async function queryCidFromRegistry(ethers, provider, config, blockHash) {
  const address = resolveContractAddress(config, "pointerRegistry");
  if (!address) return null;

  const entry = config.contracts?.pointerRegistry;
  const fragments = entry?.readAbi;
  if (!Array.isArray(fragments) || fragments.length === 0) return null;

  try {
    const contract = new ethers.Contract(address, fragments, provider);
    return await tryReadCid(contract, fragments, blockHash);
  } catch {
    return null;
  }
}

async function queryAnchorOnChain(ethers, provider, config, blockHash) {
  const anchorAddress = resolveContractAddress(config, "alxAnchor");
  if (!anchorAddress) return null;

  try {
    const contract = new ethers.Contract(anchorAddress, loadAnchorAbi(), provider);
    const hash32 = blockHashToBytes32(blockHash);
    const [ts, by] = await Promise.all([
      contract.anchoredAt(hash32),
      contract.anchoredBy(hash32),
    ]);
    const anchoredAt = Number(ts);
    if (anchoredAt === 0) return null;
    return { anchoredAt, anchoredBy: by };
  } catch {
    return null;
  }
}

/**
 * @param {string} blockHash
 * @param {{ rpcUrl?: string, gateway?: string, registry?: string }} opts
 */
export async function resolveBlockFromBase(blockHash, opts = {}) {
  const config = loadBaseMainnetConfig();
  const rpcUrl = opts.rpcUrl || resolveRpcUrl(config);
  const gateway = (opts.gateway || "https://ipfs.io/ipfs").replace(/\/$/, "");

  let ethers;
  try {
    ethers = await import("ethers");
  } catch {
    throw new Error("ethers is required for --chain base. Install from repo root: pnpm install");
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl, config.chainId);

  const [cid, anchorMeta] = await Promise.all([
    queryCidFromRegistry(ethers, provider, config, blockHash),
    queryAnchorOnChain(ethers, provider, config, blockHash),
  ]);

  if (!cid) return null;

  const { resolveBlock } = await import("./resolve.js");
  const blockResult = await resolveBlock(blockHash, {
    gateway,
    registry: opts.registry,
    cid,
    cidSource: "base-on-chain",
  });

  if (!blockResult) return null;
  if (anchorMeta) return { ...blockResult, ...anchorMeta };
  return blockResult;
}

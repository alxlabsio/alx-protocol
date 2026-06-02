/**
 * Load Base mainnet integration metadata (informative, non-normative).
 */

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { REPO_ROOT } from "./repo-root.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(REPO_ROOT, "protocol/chains/base-mainnet.json");

/** @returns {object} */
export function loadBaseMainnetConfig() {
  if (!existsSync(CONFIG_PATH)) {
    throw new Error(`Base integration config not found: ${CONFIG_PATH}`);
  }
  return JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
}

/**
 * Load the ALXAnchor human-readable ABI from contracts/abis/ALXAnchor.json.
 * Single source — imported by anchor.js and chain-resolve.js.
 * @returns {string[]}
 */
export function loadAnchorAbi() {
  const abiPath = join(REPO_ROOT, "contracts/abis/ALXAnchor.json");
  return JSON.parse(readFileSync(abiPath, "utf-8"));
}

/**
 * @param {object} config
 * @param {"alxAnchor"|"pointerRegistry"|"checkpointRegistry"|"platformRegistry"} role
 */
export function resolveContractAddress(config, role) {
  const entry = config.contracts?.[role];
  if (!entry) return null;

  const envKey = entry.envOverride;
  if (envKey && process.env[envKey]?.trim()) {
    return process.env[envKey].trim();
  }

  return entry.address || null;
}

export function resolveRpcUrl(config) {
  const envKey = config.rpc?.envOverride;
  if (envKey && process.env[envKey]?.trim()) {
    return process.env[envKey].trim();
  }
  return config.rpc?.defaultUrl || "https://mainnet.base.org";
}

export function blockHashToBytes32(blockHash) {
  const normalized = String(blockHash).trim().toLowerCase();
  if (!/^0x[a-f0-9]{64}$/.test(normalized)) {
    throw new Error(`Invalid blockHash: ${blockHash}`);
  }
  return normalized;
}

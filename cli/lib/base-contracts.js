/**
 * Load Base network and contract deployment configuration (informative, non-normative).
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT } from "./repo-root.js";

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
 * Single source imported by anchor.js.
 * @returns {string[]}
 */
export function loadAnchorAbi() {
  const abi = loadContractAbi(loadBaseMainnetConfig(), "anchor");
  if (!abi) throw new Error("Missing contracts.anchor.abi in base-mainnet.json");
  return abi;
}

/** Load the ABI declared by a contract entry in the deployment config. */
function loadContractAbi(config, contractId) {
  const abiRel = config.contracts?.[contractId]?.abi;
  if (!abiRel) return null;
  const abiPath = join(REPO_ROOT, abiRel);
  if (!existsSync(abiPath)) {
    throw new Error(`Contract ABI not found: ${abiRel}`);
  }
  const abi = JSON.parse(readFileSync(abiPath, "utf-8"));
  if (!Array.isArray(abi)) throw new Error(`Contract ABI must be an array: ${abiRel}`);
  return abi;
}

/**
 * @param {object} config
 * @param {"anchor"} contractId
 * @param {string} [networkId]
 */
export function resolveContractAddress(config, contractId, networkId) {
  const entry = config.contracts?.[contractId];
  if (!entry) return null;

  const selectedNetwork = networkId || resolveContractNetwork(config, contractId);
  const deployment = entry.deployments?.[selectedNetwork];
  if (!deployment) return null;

  const envKey = deployment.addressEnv;
  if (envKey && process.env[envKey]?.trim()) {
    return process.env[envKey].trim();
  }

  return deployment.address || null;
}

export function resolveContractNetwork(config, contractId) {
  return config.contracts?.[contractId]?.defaultNetwork || null;
}

export function resolveNetwork(config, networkId) {
  return config.networks?.[networkId] || null;
}

export function resolveRpcUrl(config, networkId = "base-mainnet") {
  const network = resolveNetwork(config, networkId);
  if (!network) throw new Error(`Unknown network in base-mainnet.json: ${networkId}`);
  const envKey = network.rpcUrlEnv;
  if (envKey && process.env[envKey]?.trim()) {
    return process.env[envKey].trim();
  }
  return network.rpcUrl || null;
}

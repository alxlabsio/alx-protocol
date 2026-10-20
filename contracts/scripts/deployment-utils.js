const { readFileSync, writeFileSync } = require("node:fs");

const MAINNET_CONFIRMATION = "base-mainnet:8453:ALXAnchor";

const DEPLOYMENT_TARGETS = Object.freeze({
  "base-sepolia": Object.freeze({
    chainId: 84532,
    defaultConfirmations: 2,
  }),
  "base-mainnet": Object.freeze({
    chainId: 8453,
    defaultConfirmations: 5,
  }),
});

const PUBLIC_MAINNET_RPCS = new Set([
  "https://mainnet.base.org",
  "https://mainnet-preconf.base.org",
]);

function normalizedUrl(value) {
  return value.trim().replace(/\/+$/, "").toLowerCase();
}

function validateDeploymentTarget({ networkName, chainId, env = process.env }) {
  const target = DEPLOYMENT_TARGETS[networkName];
  if (!target) {
    throw new Error(`Unsupported deployment network: ${networkName}`);
  }

  const actualChainId = Number(chainId);
  if (!Number.isSafeInteger(actualChainId) || actualChainId !== target.chainId) {
    throw new Error(
      `RPC chainId mismatch for ${networkName}: expected ${target.chainId}, got ${chainId}`,
    );
  }

  if (networkName === "base-mainnet") {
    if (env.ALX_CONFIRM_MAINNET_DEPLOY !== MAINNET_CONFIRMATION) {
      throw new Error(
        `Mainnet deployment requires ALX_CONFIRM_MAINNET_DEPLOY=${MAINNET_CONFIRMATION}`,
      );
    }

    const rpcUrl = env.ALX_BASE_RPC_URL?.trim();
    if (!rpcUrl) {
      throw new Error("Mainnet deployment requires ALX_BASE_RPC_URL");
    }
    if (PUBLIC_MAINNET_RPCS.has(normalizedUrl(rpcUrl))) {
      throw new Error("Mainnet deployment requires a dedicated production RPC endpoint");
    }
    if (!env.BASESCAN_API_KEY?.trim()) {
      throw new Error("Mainnet deployment requires BASESCAN_API_KEY for source verification");
    }
  }

  return target;
}

function resolveConfirmationCount(rawValue, networkName) {
  const target = DEPLOYMENT_TARGETS[networkName];
  if (!target) throw new Error(`Unsupported deployment network: ${networkName}`);
  if (rawValue === undefined || rawValue === null || rawValue === "") {
    return target.defaultConfirmations;
  }
  if (!/^[1-9][0-9]*$/.test(String(rawValue))) {
    throw new Error("ALX_DEPLOY_CONFIRMATIONS must be a positive integer");
  }
  const confirmations = Number(rawValue);
  if (!Number.isSafeInteger(confirmations)) {
    throw new Error("ALX_DEPLOY_CONFIRMATIONS exceeds the supported integer range");
  }
  return confirmations;
}

function validateSourceState({ networkName, commit, clean }) {
  if (networkName !== "base-mainnet") return;
  if (!clean || !/^[a-fA-F0-9]{40,64}$/.test(commit || "")) {
    throw new Error("Mainnet deployment requires a clean Git worktree and index at a committed revision");
  }
}

function buildDeploymentRecord({
  address,
  transactionHash,
  blockNumber,
  deployedBy,
  deployedAt,
  confirmations,
  runtimeBytecodeHash,
  sourceCommit,
}) {
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) throw new Error("Invalid deployment address");
  if (!/^0x[a-fA-F0-9]{64}$/.test(transactionHash)) {
    throw new Error("Invalid deployment transaction hash");
  }
  if (!Number.isSafeInteger(blockNumber) || blockNumber < 0) {
    throw new Error("Invalid deployment block number");
  }
  if (!/^0x[a-fA-F0-9]{40}$/.test(deployedBy)) throw new Error("Invalid deployer address");
  if (Number.isNaN(Date.parse(deployedAt))) throw new Error("Invalid deployment timestamp");
  if (!Number.isSafeInteger(confirmations) || confirmations < 1) {
    throw new Error("Invalid deployment confirmation count");
  }
  if (!/^0x[a-fA-F0-9]{64}$/.test(runtimeBytecodeHash)) {
    throw new Error("Invalid runtime bytecode hash");
  }
  if (sourceCommit !== null && !/^[a-fA-F0-9]{40,64}$/.test(sourceCommit)) {
    throw new Error("Invalid source commit");
  }

  return {
    state: "deployed",
    address,
    transactionHash,
    blockNumber,
    deployedBy,
    deployedAt,
    confirmations,
    runtimeBytecodeHash,
    sourceCommit,
  };
}

function updateIntegrationConfig(configPath, networkName, deploymentRecord) {
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  if (!config.networks?.[networkName]) {
    throw new Error(`Network ${networkName} is not declared in the deployment config`);
  }

  const anchor = config.contracts?.anchor;
  const current = anchor?.deployments?.[networkName];
  if (!current) {
    throw new Error(`Missing contracts.anchor.deployments.${networkName}`);
  }
  if (current.state === "deployed" || current.address) {
    throw new Error(`ALXAnchor already has a recorded deployment on ${networkName}`);
  }

  anchor.deployments[networkName] = {
    ...current,
    ...deploymentRecord,
  };
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
  return config;
}

module.exports = {
  DEPLOYMENT_TARGETS,
  MAINNET_CONFIRMATION,
  buildDeploymentRecord,
  resolveConfirmationCount,
  updateIntegrationConfig,
  validateDeploymentTarget,
  validateSourceState,
};

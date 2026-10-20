const { ethers, network, artifacts } = require("hardhat");
const { execFileSync } = require("node:child_process");
const { join } = require("node:path");
const {
  buildDeploymentRecord,
  resolveConfirmationCount,
  updateIntegrationConfig,
  validateDeploymentTarget,
  validateSourceState,
} = require("./deployment-utils.js");

const CONFIG_PATH = join(__dirname, "../../protocol/chains/base-mainnet.json");
const REPO_ROOT = join(__dirname, "../..");

function readSourceState() {
  try {
    const commit = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: REPO_ROOT,
      encoding: "utf8",
    }).trim();
    const status = execFileSync("git", ["status", "--porcelain"], {
      cwd: REPO_ROOT,
      encoding: "utf8",
    }).trim();
    return { commit, clean: status.length === 0 };
  } catch {
    return { commit: null, clean: false };
  }
}

async function main() {
  const providerNetwork = await ethers.provider.getNetwork();
  validateDeploymentTarget({
    networkName: network.name,
    chainId: providerNetwork.chainId,
  });

  const source = readSourceState();
  validateSourceState({ networkName: network.name, ...source });

  const confirmations = resolveConfirmationCount(
    process.env.ALX_DEPLOY_CONFIRMATIONS,
    network.name,
  );
  const [deployer] = await ethers.getSigners();
  if (!deployer) throw new Error(`No deployment signer configured for ${network.name}`);
  const deployerBalance = await ethers.provider.getBalance(deployer.address);
  if (deployerBalance === 0n) throw new Error(`Deployment signer has no funds on ${network.name}`);

  console.log(`Deploying ALXAnchor on ${network.name} with: ${deployer.address}`);
  console.log(`Source commit: ${source.commit || "unavailable"} (${source.clean ? "clean" : "dirty"})`);
  console.log(`Receipt confirmations required: ${confirmations}`);

  const ALXAnchor = await ethers.getContractFactory("ALXAnchor");
  const contract = await ALXAnchor.deploy();
  const deploymentTransaction = contract.deploymentTransaction();
  if (!deploymentTransaction) throw new Error("Deployment transaction was not created");
  console.log(`Deployment transaction: ${deploymentTransaction.hash}`);

  const receipt = await deploymentTransaction.wait(confirmations);
  if (!receipt || receipt.status !== 1) throw new Error("Deployment transaction did not succeed");
  const deploymentBlock = await ethers.provider.getBlock(receipt.blockNumber);
  if (!deploymentBlock) throw new Error(`Deployment block ${receipt.blockNumber} is unavailable`);

  const address = await contract.getAddress();
  const runtimeCode = await ethers.provider.getCode(address);
  if (runtimeCode === "0x") throw new Error(`No runtime bytecode found at ${address}`);

  const artifact = await artifacts.readArtifact("ALXAnchor");
  const expectedRuntimeHash = ethers.keccak256(artifact.deployedBytecode);
  const runtimeBytecodeHash = ethers.keccak256(runtimeCode);
  if (runtimeBytecodeHash !== expectedRuntimeHash) {
    throw new Error("Deployed runtime bytecode does not match the compiled ALXAnchor artifact");
  }

  const maxBatchSize = await contract.MAX_BATCH_SIZE();
  if (maxBatchSize !== 256n) throw new Error(`Unexpected MAX_BATCH_SIZE: ${maxBatchSize}`);

  const deploymentRecord = buildDeploymentRecord({
    address,
    transactionHash: receipt.hash,
    blockNumber: receipt.blockNumber,
    deployedBy: deployer.address,
    deployedAt: new Date(deploymentBlock.timestamp * 1000).toISOString(),
    confirmations,
    runtimeBytecodeHash,
    sourceCommit: source.commit,
  });
  updateIntegrationConfig(CONFIG_PATH, network.name, deploymentRecord);

  console.log(`ALXAnchor deployed and bytecode-verified: ${address}`);
  console.log(`Updated the ${network.name} deployment record in protocol/chains/base-mainnet.json.`);
  console.log(
    `Next: pnpm --filter @alx-protocol/contracts run verify:${network.name === "base-mainnet" ? "mainnet" : "sepolia"} -- ${address}`,
  );
}

main().catch((err) => { console.error(err.message); process.exit(1); });

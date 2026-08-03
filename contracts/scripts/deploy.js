const { ethers, network } = require("hardhat");
const { writeFileSync, readFileSync } = require("fs");
const { join } = require("path");

const CONFIG_PATH = join(__dirname, "../../protocol/chains/base-mainnet.json");

function updateIntegrationConfig(address, networkName) {
  const config = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
  if (!config.networks?.[networkName]) {
    console.log(`Network ${networkName} is not declared in the deployment config.`);
    return;
  }
  if (!config.contracts?.anchor?.deployment) {
    throw new Error("Missing contracts.anchor.deployment in base-mainnet.json");
  }
  config.contracts.anchor.lifecycle = "active";
  config.contracts.anchor.deployment.network = networkName;
  config.contracts.anchor.deployment.state = "deployed";
  config.contracts.anchor.deployment.address = address;
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n");
  console.log(`Updated protocol/chains/base-mainnet.json with the ${networkName} deployment.`);
}

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying ALXAnchor on ${network.name} with: ${deployer.address}`);

  const ALXAnchor = await ethers.getContractFactory("ALXAnchor");
  const contract = await ALXAnchor.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log(`ALXAnchor deployed: ${address}`);

  updateIntegrationConfig(address, network.name);
}

main().catch((err) => { console.error(err.message); process.exit(1); });

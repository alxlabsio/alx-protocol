require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  paths: {
    sources: "./src",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    "base-sepolia": {
      url: process.env.ALX_BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
      accounts: process.env.ALX_DEPLOY_KEY ? [process.env.ALX_DEPLOY_KEY] : [],
    },
    "base-mainnet": {
      url: process.env.ALX_BASE_RPC_URL || "https://mainnet.base.org",
      accounts: process.env.ALX_DEPLOY_KEY ? [process.env.ALX_DEPLOY_KEY] : [],
    },
  },
  etherscan: {
    apiKey: {
      "base-sepolia": process.env.BASESCAN_API_KEY || "",
      "base-mainnet": process.env.BASESCAN_API_KEY || "",
    },
    customChains: [
      {
        network: "base-sepolia",
        chainId: 84532,
        urls: {
          apiURL: "https://api-sepolia.basescan.org/api",
          browserURL: "https://sepolia.basescan.org",
        },
      },
      {
        network: "base-mainnet",
        chainId: 8453,
        urls: {
          apiURL: "https://api.basescan.org/api",
          browserURL: "https://basescan.org",
        },
      },
    ],
  },
};

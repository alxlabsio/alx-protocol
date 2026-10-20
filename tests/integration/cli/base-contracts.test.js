import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  loadAnchorAbi,
  loadBaseMainnetConfig,
  resolveContractAddress,
  resolveContractNetwork,
  resolveNetwork,
  resolveRpcUrl,
} from "../../../cli/lib/base-contracts.js";

describe("base-contracts", () => {
  const envSnapshot = { ...process.env };

  afterEach(() => {
    process.env = { ...envSnapshot };
  });

  it("loads the minimal Base integration configuration", () => {
    const config = loadBaseMainnetConfig();
    assert.equal(config.configVersion, "1.0.0");
    assert.equal(config.protocolVersion, "1");
    assert.equal(config.profile, "minimal-chain");
    assert.deepEqual(config.defaults.artifactPath, ["blocks", "ipfs"]);
    assert.equal(config.defaults.onChainWrites, "none");
    assert.equal(config.optionalOperations.anchor.contract, "anchor");
    assert.deepEqual(Object.keys(config.contracts), ["anchor"]);
    assert.deepEqual(config.contracts.anchor.capabilities, ["anchor-block-hash", "anchor-batch"]);
    assert.equal(config.contracts.anchor.defaultNetwork, "base-sepolia");
    assert.deepEqual(Object.keys(config.contracts.anchor.deployments), [
      "base-sepolia",
      "base-mainnet",
    ]);
    assert.equal(config.contracts.anchor.deployments["base-sepolia"].state, "planned");
    assert.equal(config.contracts.anchor.deployments["base-mainnet"].state, "planned");
  });

  it("uses declared lifecycle and deployment states consistently", () => {
    const config = loadBaseMainnetConfig();
    const lifecycleValues = new Set(["planned", "active"]);
    const deploymentStates = new Set(["planned"]);

    for (const component of Object.values(config.components)) {
      assert.equal(lifecycleValues.has(component.lifecycle), true);
    }
    for (const contract of Object.values(config.contracts)) {
      assert.equal(lifecycleValues.has(contract.lifecycle), true);
      assert.ok(config.networks[contract.defaultNetwork]);
      for (const [networkId, deployment] of Object.entries(contract.deployments)) {
        assert.ok(config.networks[networkId]);
        assert.equal(deploymentStates.has(deployment.state), true);
        assert.equal(deployment.address, null);
      }
    }
  });

  it("loads the anchor ABI and supports per-network address overrides", () => {
    const config = loadBaseMainnetConfig();
    assert.ok(loadAnchorAbi().some((fragment) => fragment.includes("anchorBatch")));
    assert.equal(resolveContractAddress(config, "anchor"), null);
    process.env.ALX_ANCHOR_ADDRESS_BASE_SEPOLIA = "0x0000000000000000000000000000000000000001";
    assert.equal(resolveContractAddress(config, "anchor"), "0x0000000000000000000000000000000000000001");
    process.env.ALX_ANCHOR_ADDRESS_BASE_MAINNET = "0x0000000000000000000000000000000000000002";
    assert.equal(
      resolveContractAddress(config, "anchor", "base-mainnet"),
      "0x0000000000000000000000000000000000000002",
    );
  });

  it("resolves network metadata and network-specific RPC environment variables", () => {
    const config = loadBaseMainnetConfig();
    assert.equal(resolveNetwork(config, "base-mainnet").chainId, 8453);
    assert.equal(resolveNetwork(config, "base-sepolia").chainId, 84532);
    assert.equal(resolveContractNetwork(config, "anchor"), "base-sepolia");
    assert.equal(resolveRpcUrl(config, "base-mainnet"), "https://mainnet.base.org");
    process.env.ALX_BASE_SEPOLIA_RPC_URL = "https://sepolia-rpc.example";
    assert.equal(resolveRpcUrl(config, "base-sepolia"), "https://sepolia-rpc.example");
  });

});

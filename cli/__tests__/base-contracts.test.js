import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  loadBaseMainnetConfig,
  resolveContractAddress,
  resolveRpcUrl,
  blockHashToBytes32,
} from "../lib/base-contracts.js";

describe("base-contracts", () => {
  const envSnapshot = { ...process.env };

  afterEach(() => {
    process.env = { ...envSnapshot };
  });

  it("loads pointer registry address from config", () => {
    const config = loadBaseMainnetConfig();
    assert.equal(config.chainId, 8453);
    assert.ok(config.architecture.defaultOffChain.includes("alxIndex"));
    assert.ok(config.architecture.defaultOffChain.includes("alxRegistry"));
    const addr = resolveContractAddress(config, "pointerRegistry");
    assert.equal(addr, "0xD1F216E872a9ed4b90E364825869c2F377155B29");
  });

  it("env override wins for pointer registry", () => {
    const config = loadBaseMainnetConfig();
    process.env.ALX_POINTER_REGISTRY_ADDRESS = "0x0000000000000000000000000000000000000001";
    const addr = resolveContractAddress(config, "pointerRegistry");
    assert.equal(addr, "0x0000000000000000000000000000000000000001");
  });

  it("resolveRpcUrl uses default then env", () => {
    const config = loadBaseMainnetConfig();
    assert.equal(resolveRpcUrl(config), "https://mainnet.base.org");
    process.env.ALX_BASE_RPC_URL = "https://rpc.example";
    assert.equal(resolveRpcUrl(config), "https://rpc.example");
  });

  it("blockHashToBytes32 normalizes valid hash", () => {
    const h = "0x" + "Ab".repeat(32);
    assert.equal(blockHashToBytes32(h), h.toLowerCase());
  });
});

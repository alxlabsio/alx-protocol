import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";

const require = createRequire(import.meta.url);
const {
  MAINNET_CONFIRMATION,
  buildDeploymentRecord,
  resolveConfirmationCount,
  updateIntegrationConfig,
  validateDeploymentTarget,
  validateSourceState,
} = require("../../../contracts/scripts/deployment-utils.js");

const ADDRESS = `0x${"11".repeat(20)}`;
const DEPLOYER = `0x${"22".repeat(20)}`;
const TX_HASH = `0x${"33".repeat(32)}`;
const BYTECODE_HASH = `0x${"44".repeat(32)}`;
const SOURCE_COMMIT = "55".repeat(20);

function deploymentRecord() {
  return buildDeploymentRecord({
    address: ADDRESS,
    transactionHash: TX_HASH,
    blockNumber: 123,
    deployedBy: DEPLOYER,
    deployedAt: "2026-08-22T12:00:00.000Z",
    confirmations: 5,
    runtimeBytecodeHash: BYTECODE_HASH,
    sourceCommit: SOURCE_COMMIT,
  });
}

describe("deployment target safety", () => {
  it("accepts Base Sepolia only on its declared chain", () => {
    assert.equal(
      validateDeploymentTarget({ networkName: "base-sepolia", chainId: 84532n }).chainId,
      84532,
    );
    assert.throws(
      () => validateDeploymentTarget({ networkName: "base-sepolia", chainId: 8453n }),
      /chainId mismatch/,
    );
  });

  it("requires an exact mainnet confirmation phrase", () => {
    const env = {
      ALX_BASE_RPC_URL: "https://base-mainnet.example",
      BASESCAN_API_KEY: "test-key",
    };
    assert.throws(
      () => validateDeploymentTarget({ networkName: "base-mainnet", chainId: 8453n, env }),
      /ALX_CONFIRM_MAINNET_DEPLOY/,
    );
    env.ALX_CONFIRM_MAINNET_DEPLOY = MAINNET_CONFIRMATION;
    assert.equal(
      validateDeploymentTarget({ networkName: "base-mainnet", chainId: 8453n, env }).chainId,
      8453,
    );
  });

  it("rejects public Base endpoints for a mainnet deployment", () => {
    const env = {
      ALX_BASE_RPC_URL: "https://mainnet.base.org/",
      ALX_CONFIRM_MAINNET_DEPLOY: MAINNET_CONFIRMATION,
      BASESCAN_API_KEY: "test-key",
    };
    assert.throws(
      () => validateDeploymentTarget({ networkName: "base-mainnet", chainId: 8453n, env }),
      /dedicated production RPC/,
    );
  });

  it("uses conservative defaults and validates confirmation overrides", () => {
    assert.equal(resolveConfirmationCount(undefined, "base-sepolia"), 2);
    assert.equal(resolveConfirmationCount(undefined, "base-mainnet"), 5);
    assert.equal(resolveConfirmationCount("9", "base-mainnet"), 9);
    assert.throws(() => resolveConfirmationCount("0", "base-mainnet"), /positive integer/);
  });

  it("requires mainnet source to be a clean committed revision", () => {
    assert.doesNotThrow(() => validateSourceState({
      networkName: "base-mainnet",
      commit: SOURCE_COMMIT,
      clean: true,
    }));
    assert.throws(
      () => validateSourceState({ networkName: "base-mainnet", commit: SOURCE_COMMIT, clean: false }),
      /clean Git worktree/,
    );
    assert.throws(
      () => validateSourceState({ networkName: "base-mainnet", commit: null, clean: true }),
      /committed revision/,
    );
    assert.doesNotThrow(() => validateSourceState({
      networkName: "base-sepolia",
      commit: null,
      clean: false,
    }));
  });
});

describe("deployment records", () => {
  let directory;

  afterEach(() => {
    if (directory) rmSync(directory, { recursive: true, force: true });
  });

  it("updates only the selected network and preserves publication lifecycle", () => {
    directory = mkdtempSync(join(tmpdir(), "alx-deployment-"));
    const configPath = join(directory, "base-mainnet.json");
    writeFileSync(configPath, JSON.stringify({
      networks: {
        "base-sepolia": { chainId: 84532 },
        "base-mainnet": { chainId: 8453 },
      },
      contracts: {
        anchor: {
          lifecycle: "planned",
          defaultNetwork: "base-sepolia",
          deployments: {
            "base-sepolia": {
              state: "planned",
              address: null,
              addressEnv: "ALX_ANCHOR_ADDRESS_BASE_SEPOLIA",
            },
            "base-mainnet": {
              state: "planned",
              address: null,
              addressEnv: "ALX_ANCHOR_ADDRESS_BASE_MAINNET",
            },
          },
        },
      },
    }));

    const updated = updateIntegrationConfig(configPath, "base-mainnet", deploymentRecord());
    assert.equal(updated.contracts.anchor.lifecycle, "planned");
    assert.equal(updated.contracts.anchor.defaultNetwork, "base-sepolia");
    assert.equal(updated.contracts.anchor.deployments["base-sepolia"].state, "planned");
    assert.equal(updated.contracts.anchor.deployments["base-mainnet"].state, "deployed");
    assert.equal(updated.contracts.anchor.deployments["base-mainnet"].address, ADDRESS);
    assert.equal(
      updated.contracts.anchor.deployments["base-mainnet"].addressEnv,
      "ALX_ANCHOR_ADDRESS_BASE_MAINNET",
    );
    assert.deepEqual(JSON.parse(readFileSync(configPath, "utf8")), updated);
  });

  it("refuses to overwrite an existing deployment record", () => {
    directory = mkdtempSync(join(tmpdir(), "alx-deployment-"));
    const configPath = join(directory, "base-mainnet.json");
    writeFileSync(configPath, JSON.stringify({
      networks: { "base-mainnet": { chainId: 8453 } },
      contracts: {
        anchor: {
          deployments: {
            "base-mainnet": { state: "deployed", address: ADDRESS },
          },
        },
      },
    }));
    assert.throws(
      () => updateIntegrationConfig(configPath, "base-mainnet", deploymentRecord()),
      /already has a recorded deployment/,
    );
  });
});

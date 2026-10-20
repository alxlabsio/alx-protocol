import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, it } from "node:test";
import sdk from "../../../cli/lib/sdk.js";

const here = dirname(fileURLToPath(import.meta.url));
const cli = resolve(here, "../../../cli/bin/alx.js");
const blockHash = "0x" + "ab".repeat(32);
const anchorEnvKeys = [
  "ALX_BASE_SEPOLIA_RPC_URL",
  "ALX_ANCHOR_ADDRESS",
  "ALX_ANCHOR_ADDRESS_BASE_SEPOLIA",
  "ALX_ANCHOR_ADDRESS_BASE_MAINNET",
  "ALX_DEPLOY_KEY",
];

function run(cwd, args, overrides = {}) {
  const env = { ...process.env };
  for (const key of anchorEnvKeys) delete env[key];
  Object.assign(env, overrides);
  return spawnSync(process.execPath, [cli, ...args], { cwd, encoding: "utf8", env });
}

function assertRpcOverride(result) {
  assert.equal(result.status, 1);
  assert.match(result.stderr, /unsupported protocol not-a-url/);
  assert.doesNotMatch(result.stderr, /RPC URL required/);
}

describe("anchor CLI routing", () => {
  let cwd;

  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), "alx-anchor-cli-"));
  });

  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
  });

  it("routes anchor status without referencing an undefined option index", () => {
    const result = run(cwd, ["anchor", "status", blockHash]);
    assert.equal(result.status, 1);
    assert.doesNotMatch(result.stderr, /ReferenceError|rpcIdx/);
    assert.match(result.stderr, /RPC URL required for base-sepolia/);

    const override = run(cwd, ["anchor", "status", blockHash, "--rpc-url", "not-a-url"]);
    assertRpcOverride(override);
  });

  it("routes single and batch creation through the canonical command", () => {
    const block = sdk.createBlock({ type: "test", text: "anchor routing" }, []);
    const blockPath = join(cwd, "anchor.block.json");
    writeFileSync(blockPath, JSON.stringify(block));

    const single = run(cwd, ["anchor", "create", blockPath]);
    assert.equal(single.status, 1);
    assert.match(single.stderr, /RPC URL required for base-sepolia/);

    const singleOverride = run(cwd, ["anchor", "create", blockPath, "--rpc-url", "not-a-url"]);
    assertRpcOverride(singleOverride);

    const batch = run(cwd, [
      "anchor", "create", "--hashes",
      "0x" + "aa".repeat(32) + ",0x" + "bb".repeat(32),
    ]);
    assert.equal(batch.status, 1);
    assert.match(batch.stderr, /RPC URL required for base-sepolia/);

    const batchOverride = run(cwd, [
      "anchor", "create", "--hashes",
      "0x" + "aa".repeat(32) + ",0x" + "bb".repeat(32),
      "--rpc-url", "not-a-url",
    ]);
    assertRpcOverride(batchOverride);
  });

  it("loads project .env anchor configuration before doctor runs", () => {
    writeFileSync(join(cwd, ".env"), [
      "ALX_IPFS_ENDPOINT=http://127.0.0.1:1",
      "ALX_BASE_SEPOLIA_RPC_URL=http://127.0.0.1:8545",
      "ALX_ANCHOR_ADDRESS_BASE_SEPOLIA=0x" + "11".repeat(20),
      "ALX_DEPLOY_KEY=0x" + "22".repeat(32),
      "",
    ].join("\n"));

    const result = run(cwd, ["doctor"]);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Base\/EVM ready for reads and writes on base-sepolia/);
  });
});

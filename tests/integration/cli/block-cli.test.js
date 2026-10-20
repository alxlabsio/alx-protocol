import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const testDir = dirname(fileURLToPath(import.meta.url));
const cliPath = resolve(testDir, "../../../cli/bin/alx.js");

function run(cwd, args) {
  return spawnSync(process.execPath, [cliPath, ...args], { cwd, encoding: "utf-8" });
}

function runJson(cwd, args) {
  const result = run(cwd, args);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

function hashAt(index) {
  return "0x" + index.toString(16).padStart(64, "0");
}

describe("primitive-first Block CLI", () => {
  let cwd;

  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), "alx-block-cli-"));
    writeFileSync(join(cwd, "one.json"), '{"step":1}');
    writeFileSync(join(cwd, "two.md"), "# Two\r\n");
    writeFileSync(join(cwd, "three.json"), '{"step":3}');
    writeFileSync(join(cwd, "merge.json"), '{"step":"merge"}');
    writeFileSync(join(cwd, "dry.json"), '{"step":"dry"}');
  });

  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
  });

  it("creates a three-step @last chain and resolves show, verify, and all listing", () => {
    const first = runJson(cwd, ["block", "create", "one.json", "--json"]);
    const second = runJson(cwd, ["block", "create", "two.md", "--parent", "@last", "--json"]);
    const third = runJson(cwd, ["block", "create", "three.json", "--parent", "@last", "--json"]);

    assert.deepEqual(second.parentHashes, [first.blockHash]);
    assert.deepEqual(third.parentHashes, [second.blockHash]);
    assert.deepEqual(second.content, {
      type: "document",
      name: "two.md",
      mediaType: "text/markdown",
      text: "# Two\r\n",
    });

    const shown = runJson(cwd, ["block", "show", third.blockHash.slice(0, 12)]);
    assert.deepEqual(shown, third);
    assert.equal(run(cwd, ["block", "verify", "@last"]).status, 0);

    const listed = runJson(cwd, ["block", "list", "--all", "--json"]);
    assert.equal(listed.count, 3);
    assert.ok(listed.blocks.every((entry) => entry.available === true));
    assert.ok(listed.blocks.every((entry) => entry.path.includes(join(".alx", "blocks"))));
  });

  it("creates branches and a deterministic merge from repeated parent references", () => {
    const first = runJson(cwd, ["block", "create", "one.json", "--json"]);
    const second = runJson(cwd, [
      "block", "create", "two.md", "--parent", "@last", "--json",
    ]);
    const third = runJson(cwd, [
      "block", "create", "three.json",
      "--parent", first.blockHash.slice(0, 18),
      "--json",
    ]);
    const firstPath = join(
      cwd,
      ".alx",
      "blocks",
      first.blockHash + ".block.json",
    );
    const merge = runJson(cwd, [
      "block", "create", "merge.json",
      "--parent", firstPath,
      "--parent", second.blockHash,
      "--parent", third.blockHash.slice(0, 18),
      "--verify-parents",
      "--json",
    ]);

    assert.deepEqual(second.parentHashes, [first.blockHash]);
    assert.deepEqual(third.parentHashes, [first.blockHash]);
    assert.deepEqual(merge.parentHashes, [first.blockHash, second.blockHash, third.blockHash].sort());

    const stateBefore = readFileSync(join(cwd, ".alx", "state.json"), "utf-8");
    const dry = runJson(cwd, [
      "block", "create", "merge.json",
      "--parent", third.blockHash,
      "--parent", first.blockHash,
      "--parent", second.blockHash,
      "--dry-run",
      "--json",
    ]);
    assert.equal(dry.dryRun, true);
    assert.equal(dry.block.blockHash, merge.blockHash);
    assert.equal(readFileSync(join(cwd, ".alx", "state.json"), "utf-8"), stateBefore);

    const isolated = runJson(cwd, [
      "block", "create", "dry.json",
      "--parent", first.blockHash,
      "--dry-run",
      "--json",
    ]);
    assert.equal(
      existsSync(
        join(cwd, ".alx", "blocks", isolated.block.blockHash + ".block.json"),
      ),
      false,
    );

    const duplicate = runJson(cwd, [
      "block", "create", "merge.json",
      "--parent", first.blockHash,
      "--parent", first.blockHash,
      "--dry-run",
      "--json",
    ]);
    assert.deepEqual(duplicate.block.parentHashes, [first.blockHash]);
  });

  it("enforces the 256-parent boundary for repeated --parent", () => {
    const acceptedParents = Array.from({ length: 256 }, (_, index) =>
      hashAt(index + 1),
    );
    const acceptedArgs = ["block", "create", "merge.json"];
    for (const parent of acceptedParents) acceptedArgs.push("--parent", parent);
    acceptedArgs.push("--dry-run", "--json");

    const accepted = runJson(cwd, acceptedArgs);
    assert.deepEqual(accepted.block.parentHashes, acceptedParents.sort());

    const rejectedArgs = ["block", "create", "merge.json"];
    for (let index = 1; index <= 257; index += 1) {
      rejectedArgs.push("--parent", hashAt(index));
    }
    rejectedArgs.push("--dry-run", "--json");

    const rejected = run(cwd, rejectedArgs);
    assert.notEqual(rejected.status, 0);
    assert.match(rejected.stdout, /maximum of 256/i);
  });
});

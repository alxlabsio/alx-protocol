import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const testDir = dirname(fileURLToPath(import.meta.url));
const cliPath = resolve(testDir, "../bin/alx.js");

function run(cwd, args) {
  return spawnSync(process.execPath, [cliPath, ...args], { cwd, encoding: "utf-8" });
}

function runJson(cwd, args) {
  const result = run(cwd, args);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

describe("primitive-first Block CLI", () => {
  let cwd;

  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), "alx-block-cli-"));
    writeFileSync(join(cwd, "one.json"), '{"step":1}');
    writeFileSync(join(cwd, "two.md"), "# Two\r\n");
    writeFileSync(join(cwd, "three.json"), '{"step":3}');
    writeFileSync(join(cwd, "merge.json"), '{"step":"merge"}');
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

  it("combines repeated and comma-separated parents and leaves dry runs isolated", () => {
    const first = runJson(cwd, ["block", "create", "one.json", "--json"]);
    const second = runJson(cwd, ["block", "create", "two.md", "--json"]);
    const third = runJson(cwd, ["block", "create", "three.json", "--json"]);
    const merge = runJson(cwd, [
      "block", "create", "merge.json",
      "--parent", first.blockHash,
      "--parents", second.blockHash + "," + third.blockHash,
      "--json",
    ]);

    assert.deepEqual(merge.parentHashes, [first.blockHash, second.blockHash, third.blockHash].sort());
    const stateBefore = readFileSync(join(cwd, ".alx", "state.json"), "utf-8");
    const dry = runJson(cwd, ["block", "create", "merge.json", "--parent", "@last", "--dry-run", "--json"]);
    assert.equal(dry.dryRun, true);
    assert.equal(readFileSync(join(cwd, ".alx", "state.json"), "utf-8"), stateBefore);
    assert.equal(existsSync(join(cwd, ".alx", "blocks", dry.block.blockHash + ".block.json")), false);
  });
});

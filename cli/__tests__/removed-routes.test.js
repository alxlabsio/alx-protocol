import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";

const here = dirname(fileURLToPath(import.meta.url));
const cli = resolve(here, "../bin/alx.js");

function run(args) {
  return spawnSync(process.execPath, [cli, ...args], { encoding: "utf8" });
}

describe("canonical CLI routes", () => {
  it("documents only the canonical anchor routes", () => {
    const result = run(["--help"]);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /alx anchor create --hashes/);
    assert.match(result.stdout, /alx anchor status/);
  });

  it("rejects removed top-level compatibility routes", () => {
    const removedRoutes = [
      ["block", "set"].join(""),
      ["in", "dex"].join(""),
      ["reg", "istry"].join(""),
      ["anchor", "-query"].join(""),
      ["val", "idate"].join(""),
      ["ins", "pect"].join(""),
      ["pro", "of"].join(""),
      ["tra", "ce"].join(""),
      ["pub", "lish"].join(""),
      ["res", "olve"].join(""),
      ["ser", "ve"].join(""),
    ];
    for (const route of removedRoutes) {
      const result = run([route]);
      assert.notEqual(result.status, 0, route);
      assert.match(result.stderr, /Unknown command/, route);
    }
  });

  it("rejects the bare test compatibility route", () => {
    const result = run(["test", "removed-tests.block.json", "--against", "removed-validator.block.json"]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Usage: alx test run/);
    assert.doesNotMatch(result.stderr, /File not found/);
  });
});

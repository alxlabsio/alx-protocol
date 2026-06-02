import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sdk from "../lib/sdk.js";
import { recordBlockWrite, loadCliState, listRecentFromState, stateFilePath } from "../lib/cli-state.js";

const { createBlock } = sdk;

describe("cli-state", () => {
  let cwd;

  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), "alx-cli-state-"));
  });

  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
  });

  it("records lastBlock and recent entries", () => {
    const block = createBlock({ type: "ai.prompt", text: "Scope" }, []);
    const out = join(cwd, "a.block.json");
    recordBlockWrite({ block, outPath: out, cwd });

    const state = loadCliState(cwd);
    assert.equal(state.lastBlock.blockHash, block.blockHash);
    assert.equal(state.recent.length, 1);
    assert.ok(existsSync(stateFilePath(cwd)));

    const listed = listRecentFromState(cwd, 5);
    assert.equal(listed[0].path, out);
  });
});

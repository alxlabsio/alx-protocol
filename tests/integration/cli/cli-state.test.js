import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sdk from "../../../cli/lib/sdk.js";
import {
  blockStoreDir,
  findProjectRoot,
  listAllFromState,
  loadCliState,
  persistBlockWrite,
  stateFilePath,
} from "../../../cli/lib/cli-state.js";

const { createBlock } = sdk;

describe("cli-state", () => {
  let cwd;

  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), "alx-cli-state-"));
  });

  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
  });

  it("persists a canonical copy, explicit copy, and version 2 index entry", () => {
    const block = createBlock({ type: "ai.prompt", text: "Scope" }, []);
    const out = join(cwd, "a.block.json");
    const result = persistBlockWrite({ block, outPath: out, cwd });
    const state = loadCliState(cwd);

    assert.equal(state.version, 2);
    assert.equal(state.lastBlock.blockHash, block.blockHash);
    assert.equal(state.recent.length, 1);
    assert.equal(Object.keys(state.blocks).length, 1);
    assert.equal(state.blocks[block.blockHash].path, result.canonicalPath);
    assert.deepEqual(state.blocks[block.blockHash].outputPaths, [out]);
    assert.ok(existsSync(join(blockStoreDir(cwd), block.blockHash + ".block.json")));
    assert.equal(readFileSync(out, "utf-8"), readFileSync(result.canonicalPath, "utf-8"));
  });

  it("recreating an existing Block is idempotent", () => {
    const block = createBlock({ step: 1 }, []);
    const first = persistBlockWrite({ block, cwd });
    const second = persistBlockWrite({ block, cwd });
    assert.equal(first.reused, false);
    assert.equal(second.reused, true);
    assert.equal(listAllFromState(cwd).length, 1);
  });

  it("rejects conflicting bytes at a content-addressed path", () => {
    const block = createBlock({ step: 1 }, []);
    const result = persistBlockWrite({ block, cwd });
    writeFileSync(result.canonicalPath, "{}\n");
    assert.throws(() => persistBlockWrite({ block, cwd }), /collision/i);
  });

  it("migrates known version 1 entries on the next write", () => {
    const oldBlock = createBlock({ step: "old" }, []);
    const oldPath = join(cwd, "old.block.json");
    writeFileSync(oldPath, JSON.stringify(oldBlock, null, 2) + "\n");
    mkdirSync(join(cwd, ".alx"), { recursive: true });
    writeFileSync(
      stateFilePath(cwd),
      JSON.stringify({
        version: 1,
        lastBlock: { path: oldPath, blockHash: oldBlock.blockHash, at: "2026-01-01T00:00:00.000Z" },
        recent: [{ path: oldPath, blockHash: oldBlock.blockHash, at: "2026-01-01T00:00:00.000Z" }],
      }),
    );

    persistBlockWrite({ block: createBlock({ step: "new" }, []), cwd });
    const state = JSON.parse(readFileSync(stateFilePath(cwd), "utf-8"));
    assert.equal(state.version, 2);
    assert.ok(state.blocks[oldBlock.blockHash]);
  });

  it("uses the nearest ancestor containing .alx", () => {
    mkdirSync(join(cwd, ".alx"));
    const nested = join(cwd, "one", "two");
    mkdirSync(nested, { recursive: true });
    assert.equal(findProjectRoot(nested), cwd);
  });
});

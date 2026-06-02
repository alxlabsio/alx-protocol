import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sdk from "../lib/sdk.js";
import { recordBlockWrite, stateFilePath } from "../lib/cli-state.js";
import {
  resolveParentTokenToPath,
  resolveParentTokensToHashes,
  findBlockFileByHash,
} from "../lib/parent-resolve.js";
import { CliInputError } from "../lib/cli-args.js";

const { createBlock, validateBlock } = sdk;

describe("parent-resolve", () => {
  let cwd;
  let parentBlock;
  let parentPath;

  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), "alx-parent-resolve-"));
    parentBlock = createBlock({ type: "ai.prompt", text: "Market research scope" }, []);
    parentPath = join(cwd, "research.block.json");
    writeFileSync(parentPath, JSON.stringify(parentBlock, null, 2));
  });

  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
  });

  it("resolves parent file path", () => {
    const path = resolveParentTokenToPath("research.block.json", { cwd });
    assert.equal(path, parentPath);
  });

  it("resolves blockHash prefix to file in cwd", () => {
    const prefix = parentBlock.blockHash.slice(0, 18);
    const file = findBlockFileByHash(cwd, prefix);
    assert.equal(file, parentPath);
  });

  it("@latest uses .alx/state.json lastBlock", () => {
    const childPath = join(cwd, "child.block.json");
    const child = createBlock({ type: "ai.response", text: "Output" }, [parentBlock.blockHash]);
    writeFileSync(childPath, JSON.stringify(child, null, 2));
    recordBlockWrite({ block: child, outPath: childPath, cwd });

    const resolved = resolveParentTokenToPath("@latest", { cwd });
    assert.equal(resolved, childPath);
    assert.ok(existsSync(stateFilePath(cwd)));
  });

  it("@latest fails when state is empty", () => {
    assert.throws(
      () => resolveParentTokenToPath("@latest", { cwd }),
      (err) => err instanceof CliInputError,
    );
  });

  it("resolveParentTokensToHashes returns parent blockHash", () => {
    const hashes = resolveParentTokensToHashes(["research.block.json"], {
      cwd,
      validateSeal: validateBlock,
    });
    assert.deepEqual(hashes, [parentBlock.blockHash]);
  });
});

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sdk from "../lib/sdk.js";
import {
  CliInputError,
  getPositionals,
  isSealedBlockShape,
  parseBlockCreateArgs,
  parseBlockLinkArgs,
  resolveContentInput,
} from "../lib/cli-args.js";

const { createBlock } = sdk;

describe("cli-args", () => {
  let workDir;
  let contentPath;
  let parentPath;
  let stdinIsTTY;

  beforeEach(() => {
    workDir = mkdtempSync(join(tmpdir(), "alx-cli-args-"));
    const contentOnly = { type: "ai.response", text: "Policy-constrained agent output." };
    contentPath = join(workDir, "content.json");
    writeFileSync(contentPath, JSON.stringify(contentOnly, null, 2));

    const parentBlock = createBlock({ type: "ai.prompt", text: "Research scope" }, []);
    parentPath = join(workDir, "parent.block.json");
    writeFileSync(parentPath, JSON.stringify(parentBlock, null, 2));

    stdinIsTTY = process.stdin.isTTY;
    process.stdin.isTTY = true;
  });

  afterEach(() => {
    process.stdin.isTTY = stdinIsTTY;
    rmSync(workDir, { recursive: true, force: true });
  });

  it("getPositionals skips flag values", () => {
    const pos = getPositionals([
      "--content-file",
      "a.json",
      "--parent",
      "p.json",
      "out.block.json",
    ]);
    assert.deepEqual(pos, ["out.block.json"]);
  });

  it("isSealedBlockShape detects full Block JSON", () => {
    const block = createBlock({ type: "x", text: "y" }, []);
    assert.equal(isSealedBlockShape(block), true);
    assert.equal(isSealedBlockShape({ type: "x" }), false);
  });

  it("resolveContentInput reads --content-file", () => {
    const rel = join(workDir, "content.json");
    const { content, source } = resolveContentInput({
      args: ["--content-file", rel],
    });
    assert.equal(source, "file");
    assert.equal(content.type, "ai.response");
  });

  it("resolveContentInput rejects locked Block as content file", () => {
    assert.throws(
      () =>
        resolveContentInput({
          args: ["--content-file", parentPath],
        }),
      (err) => err instanceof CliInputError && /locked Block/i.test(err.message),
    );
  });

  it("parseBlockLinkArgs supports positionals content parent out", () => {
    const outPath = join(workDir, "child.block.json");
    const parsed = parseBlockLinkArgs([
      contentPath,
      parentPath,
      outPath,
    ]);
    assert.equal(parsed.content.type, "ai.response");
    assert.equal(parsed.parentTokens.length, 1);
    assert.equal(parsed.outPath, outPath);
    assert.equal(parsed.contentSource, "positional-file");
  });

  it("parseBlockCreateArgs supports --content-file and positional out", () => {
    const outPath = join(workDir, "new.block.json");
    const parsed = parseBlockCreateArgs([
      "--content-file",
      contentPath,
      outPath,
    ]);
    assert.equal(parsed.outPath, outPath);
    assert.deepEqual(parsed.parents, []);
  });

  it("parseBlockLinkArgs prefers --parent over positional parent", () => {
    const parsed = parseBlockLinkArgs([
      "--content-file",
      contentPath,
      "--parent",
      parentPath,
      "ignored.block.json",
    ]);
    assert.equal(parsed.parentTokens[0], parentPath);
    assert.equal(parsed.positionals.length, 1);
  });

  it("parseBlockLinkArgs requires parent", () => {
    assert.throws(
      () => parseBlockLinkArgs(["--content-file", contentPath]),
      (err) => err instanceof CliInputError,
    );
  });
});

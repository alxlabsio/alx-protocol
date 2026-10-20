import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sdk from "../../../cli/lib/sdk.js";
import {
  CliInputError,
  getPositionals,
  isSealedBlockShape,
  parseBlockCreateArgs,
  resolveContentInput,
} from "../../../cli/lib/cli-args.js";

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

  it("wraps Markdown using basename, media type, and exact text", () => {
    const markdownPath = join(workDir, "review.md");
    writeFileSync(markdownPath, Buffer.from([0xef, 0xbb, 0xbf, ...Buffer.from("# Review\r\n\r\nExact.\n")]));
    const parsed = parseBlockCreateArgs([markdownPath]);
    assert.deepEqual(parsed.content, {
      type: "document",
      name: "review.md",
      mediaType: "text/markdown",
      text: "# Review\r\n\r\nExact.\n",
    });
  });

  it("collects one reference from each repeated --parent", () => {
    const parsed = parseBlockCreateArgs([
      contentPath,
      "--parent",
      "0x" + "11".repeat(32),
      "--parent",
      "0x" + "22".repeat(32),
      "--parent",
      "0x" + "33".repeat(32),
      "--verify-parents",
    ]);
    assert.equal(parsed.parents.length, 3);
    assert.equal(parsed.verifyParents, true);
  });

  it("does not split comma-containing --parent values", () => {
    const parsed = parseBlockCreateArgs([
      contentPath,
      "--parent",
      "first.block.json,second.block.json",
    ]);
    assert.deepEqual(parsed.parents, ["first.block.json,second.block.json"]);
  });

  it("rejects invalid UTF-8, NUL text, and directories", () => {
    const invalidPath = join(workDir, "invalid.txt");
    writeFileSync(invalidPath, Buffer.from([0xc3, 0x28]));
    assert.throws(() => parseBlockCreateArgs([invalidPath]), /valid UTF-8/);

    const nulPath = join(workDir, "nul.txt");
    writeFileSync(nulPath, Buffer.from("a\0b"));
    assert.throws(() => parseBlockCreateArgs([nulPath]), /NUL/);

    const directoryPath = join(workDir, "directory.md");
    mkdirSync(directoryPath);
    assert.throws(() => parseBlockCreateArgs([directoryPath]), /directory/);
  });

});

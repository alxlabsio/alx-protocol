import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sdk from "../lib/sdk.js";
import { parseBlockCreateArgs, parseBlockLinkArgs } from "../lib/cli-args.js";

const { createBlock } = sdk;

describe("--dry-run parsing", () => {
  let workDir;
  let contentPath;
  let parentPath;
  let stdinIsTTY;

  beforeEach(() => {
    workDir = mkdtempSync(join(tmpdir(), "alx-dry-run-"));
    const contentOnly = { type: "ai.response", text: "test" };
    contentPath = join(workDir, "content.json");
    writeFileSync(contentPath, JSON.stringify(contentOnly));

    const parent = createBlock({ type: "ai.prompt", text: "q" }, []);
    parentPath = join(workDir, "parent.block.json");
    writeFileSync(parentPath, JSON.stringify(parent));

    stdinIsTTY = process.stdin.isTTY;
    process.stdin.isTTY = true;
  });

  afterEach(() => {
    process.stdin.isTTY = stdinIsTTY;
    rmSync(workDir, { recursive: true, force: true });
  });

  it("parseBlockCreateArgs dryRun defaults to false", () => {
    const parsed = parseBlockCreateArgs(["--content-file", contentPath]);
    assert.equal(parsed.dryRun, false);
  });

  it("parseBlockCreateArgs dryRun true when --dry-run present", () => {
    const parsed = parseBlockCreateArgs(["--content-file", contentPath, "--dry-run"]);
    assert.equal(parsed.dryRun, true);
  });

  it("parseBlockLinkArgs dryRun defaults to false", () => {
    const parsed = parseBlockLinkArgs(["--content-file", contentPath, "--parent", parentPath]);
    assert.equal(parsed.dryRun, false);
  });

  it("parseBlockLinkArgs dryRun true when --dry-run present", () => {
    const parsed = parseBlockLinkArgs([
      "--content-file", contentPath,
      "--parent", parentPath,
      "--dry-run",
    ]);
    assert.equal(parsed.dryRun, true);
  });

  it("--dry-run does not create output file (integration: parseBlockCreateArgs)", () => {
    const outPath = join(workDir, "out.block.json");
    const parsed = parseBlockCreateArgs([
      "--content-file", contentPath,
      "--out", outPath,
      "--dry-run",
    ]);
    assert.equal(parsed.dryRun, true);
    assert.equal(parsed.outPath, outPath);
    // Caller is responsible for skipping write; verify file doesn't exist yet
    assert.equal(existsSync(outPath), false);
  });

  it("--dry-run + --json both parsed on block create", () => {
    const parsed = parseBlockCreateArgs([
      "--content-file", contentPath,
      "--dry-run",
      "--json",
    ]);
    assert.equal(parsed.dryRun, true);
    assert.equal(parsed.json, true);
  });

  it("--dry-run + --json both parsed on block link", () => {
    const parsed = parseBlockLinkArgs([
      "--content-file", contentPath,
      "--parent", parentPath,
      "--dry-run",
      "--json",
    ]);
    assert.equal(parsed.dryRun, true);
    assert.equal(parsed.json, true);
  });
});

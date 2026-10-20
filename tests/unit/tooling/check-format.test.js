import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  findWhitespaceProblems,
  formatFailure,
  isGitWorkTree,
  listArchiveTextFiles,
  listUntrackedTextFiles,
  runDiffCheck,
} from "../../../scripts/check-format.js";

test("format checker invokes git without a shell", () => {
  const result = runDiffCheck(["--", "package.json"]);
  assert.equal(result.error, undefined);
  assert.equal(typeof result.status, "number");
});

test("format checker preserves subprocess diagnostics", () => {
  assert.equal(
    formatFailure({ stdout: "file.js:1: trailing whitespace.\n", stderr: "" }),
    "file.js:1: trailing whitespace.",
  );
});

test("format checker detects trailing whitespace in untracked text", () => {
  assert.deepEqual(
    findWhitespaceProblems("clean\nnot clean  \n", "new-file.js"),
    ["new-file.js:2: trailing whitespace"],
  );
});

test("format checker discovers untracked repository source files", () => {
  const root = mkdtempSync(join(tmpdir(), "alx-format-check-"));
  try {
    execFileSync("git", ["init", "--quiet"], { cwd: root });
    writeFileSync(join(root, "untracked.js"), "const value = 1;\n", "utf8");
    writeFileSync(join(root, "binary.bin"), "not-source", "utf8");
    assert.deepEqual(listUntrackedTextFiles(root), ["untracked.js"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("format checker scans exported source without Git metadata", () => {
  const root = mkdtempSync(join(tmpdir(), "alx-format-archive-"));
  try {
    writeFileSync(join(root, "source.js"), "const value = 1;\n", "utf8");
    mkdirSync(join(root, "node_modules"));
    writeFileSync(join(root, "node_modules", "ignored.js"), "ignored  \n", "utf8");
    assert.equal(isGitWorkTree(root), false);
    assert.deepEqual(listArchiveTextFiles(root), ["source.js"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

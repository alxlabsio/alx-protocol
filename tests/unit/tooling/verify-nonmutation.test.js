import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { diffSnapshots, snapshotRepository } from "../../../scripts/verify-repository.mjs";

test("repository snapshots detect source mutations and ignore declared build output", () => {
  const root = mkdtempSync(join(tmpdir(), "alx-verify-state-"));
  try {
    writeFileSync(join(root, "source.js"), "export const value = 1;\n", "utf8");
    const before = snapshotRepository(root);
    mkdirSync(join(root, "dist"));
    writeFileSync(join(root, "dist", "generated.js"), "generated\n", "utf8");
    assert.deepEqual(diffSnapshots(before, snapshotRepository(root)), []);

    writeFileSync(join(root, "source.js"), "export const value = 2;\n", "utf8");
    assert.deepEqual(
      diffSnapshots(before, snapshotRepository(root)),
      ["modified source.js"],
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

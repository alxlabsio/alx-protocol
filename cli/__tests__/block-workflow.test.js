import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sdk from "../lib/sdk.js";
import {
  buildBlocksetManifest,
  parseCommaSeparatedBlockHashes,
  resolveParentHashesFromFiles,
  selectBlocksetFromGraph,
} from "../lib/block-workflow.js";

const { createBlock, validateBlock } = sdk;

const H1 = "0x" + "aa".repeat(32);
const H2 = "0x" + "bb".repeat(32);

describe("block-workflow", () => {
  it("parseCommaSeparatedBlockHashes normalizes list", () => {
    const list = parseCommaSeparatedBlockHashes(` ${H1} , ${H2.toUpperCase()} `);
    assert.deepEqual(list, [H1, H2]);
  });

  it("resolveParentHashesFromFiles reads blockHash", () => {
    const parent = createBlock({ type: "ai.prompt", text: "Market research scope" }, []);
    const dir = mkdtempSync(join(tmpdir(), "alx-block-workflow-"));
    const path = join(dir, "parent.block.json");
    writeFileSync(path, JSON.stringify(parent, null, 2));
    try {
      const hashes = resolveParentHashesFromFiles([path], { validateSeal: validateBlock });
      assert.deepEqual(hashes, [parent.blockHash]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("buildBlocksetManifest derives setId and sorts hashes", () => {
    const manifest = buildBlocksetManifest({ blockHashes: [H2, H1], label: "release" });
    assert.equal(manifest.version, "1");
    assert.equal(manifest.label, "release");
    assert.equal(manifest.blockHashes.length, 2);
    assert.match(manifest.setId, /^0x[a-f0-9]{64}$/);
  });

  it("selectBlocksetFromGraph requires members in graph", () => {
    const a = createBlock({ type: "ai.prompt", text: "a" }, []);
    const b = createBlock({ type: "ai.response", text: "b" }, [a.blockHash]);
    const ok = selectBlocksetFromGraph([a, b], [a.blockHash, b.blockHash]);
    assert.equal(ok.ok, true);
    assert.equal(ok.members.length, 2);

    const bad = selectBlocksetFromGraph([a], [a.blockHash, b.blockHash]);
    assert.equal(bad.ok, false);
  });
});

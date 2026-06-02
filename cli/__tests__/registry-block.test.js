import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  validateRegistryBlockContent,
  buildRegistryBlockContent,
  validateIndexBlockContent,
  buildIndexBlockContent,
  isBlockHashInIndex,
  validateBlockset,
  BLOCKSET_MIN_SIZE,
} from "../lib/registry-block.js";

describe("registry-block", () => {
  it("accepts valid alx.registry content", () => {
    const content = buildRegistryBlockContent("xandrlabs", [
      { role: "product", blockHash: "0x" + "a".repeat(64), label: "Market synthesis" },
    ]);
    const result = validateRegistryBlockContent(content);
    assert.equal(result.ok, true);
    assert.equal(result.issues.length, 0);
    assert.equal(content.type, "alx.registry");
    assert.equal(content.parentHashes, undefined);
  });

  it("validates alx.index and inclusion helper", () => {
    const h = "0x" + "c".repeat(64);
    const content = buildIndexBlockContent("acme-platform", [
      { blockHash: h, status: "approved" },
    ]);
    assert.equal(validateIndexBlockContent(content).ok, true);
    assert.equal(isBlockHashInIndex(h, content, { approvedOnly: true }), true);
    assert.equal(isBlockHashInIndex(h, { ...content, entries: [{ blockHash: h, status: "available" }] }, { approvedOnly: true }), false);
  });

  it("validateBlockset requires at least two hashes", () => {
    const one = "0x" + "a".repeat(64);
    const two = "0x" + "b".repeat(64);
    assert.equal(BLOCKSET_MIN_SIZE, 2);
    assert.equal(validateBlockset([one]).ok, false);
    assert.equal(validateBlockset([one, two]).ok, true);
  });

  it("rejects invalid blockHash in entries", () => {
    const content = {
      type: "alx.registry",
      version: "1",
      issuer: "acme",
      entries: [{ role: "product", blockHash: "0xshort" }],
    };
    const result = validateRegistryBlockContent(content);
    assert.equal(result.ok, false);
    assert.ok(result.issues.some((i) => i.includes("blockHash")));
  });
});

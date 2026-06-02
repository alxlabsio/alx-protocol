import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { deriveSetId, parseBlockSetAnchoredCount, MAX_BLOCKSET_SIZE } from "../lib/anchor.js";

// anchorBlock, anchorBlockSet, queryAnchor require a live RPC and deployed contract.
// Those paths are covered by contracts/test/ALXAnchor.test.js (Hardhat, local chain).
// This file tests the pure helper that has no network dependency.

describe("anchor — constants", () => {
  it("MAX_BLOCKSET_SIZE matches protocol parent limit", () => {
    assert.equal(MAX_BLOCKSET_SIZE, 256);
  });
});

describe("anchor — deriveSetId()", () => {
  const H1 = "0x" + "aa".repeat(32);
  const H2 = "0x" + "bb".repeat(32);
  const H3 = "0x" + "cc".repeat(32);

  it("returns a 0x-prefixed 64-char hex string", () => {
    const id = deriveSetId([H1, H2]);
    assert.match(id, /^0x[a-f0-9]{64}$/);
  });

  it("is deterministic — same hashes, same result", () => {
    assert.equal(deriveSetId([H1, H2]), deriveSetId([H1, H2]));
  });

  it("is order-independent — sorts inputs before hashing", () => {
    assert.equal(deriveSetId([H1, H2]), deriveSetId([H2, H1]));
  });

  it("produces different ids for different hash sets", () => {
    assert.notEqual(deriveSetId([H1, H2]), deriveSetId([H1, H3]));
  });

  it("accepts exactly 2 hashes (blockset minimum)", () => {
    assert.doesNotThrow(() => deriveSetId([H1, H2]));
  });

  it("accepts more than 2 hashes", () => {
    assert.match(deriveSetId([H1, H2, H3]), /^0x[a-f0-9]{64}$/);
  });
});

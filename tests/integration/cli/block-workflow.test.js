import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateBlockHashBatch } from "../../../cli/lib/block-workflow.js";

const H1 = "0x" + "aa".repeat(32);
const H2 = "0x" + "bb".repeat(32);

describe("block-workflow", () => {
  it("validates anchor batch size and hash shape", () => {
    assert.equal(validateBlockHashBatch([H1]).ok, false);
    assert.equal(validateBlockHashBatch([H1, H2]).ok, true);
    assert.equal(validateBlockHashBatch([H1, "0xshort"]).ok, false);
  });
});

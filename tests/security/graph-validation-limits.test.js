import assert from "node:assert/strict";
import test from "node:test";

import { createBlock } from "../../sdk/dist/block.js";
import { validateGraph } from "../../sdk/dist/block-lineage.js";

test("canonical Graph verification handles a long chain without recursive traversal", () => {
  const blocks = [createBlock({ sequence: 0, purpose: "long-chain-security-check" })];
  for (let sequence = 1; sequence < 1_000; sequence += 1) {
    blocks.push(createBlock(
      { sequence, purpose: "long-chain-security-check" },
      [blocks[sequence - 1].blockHash],
    ));
  }

  const seed = blocks.at(-1);
  const result = validateGraph(
    seed,
    { kind: "finite", blocks: blocks.slice(0, -1).reverse() },
    {
      protocolVersion: "1",
      validationMode: "closed-world",
      graphRoot: seed.blockHash,
      externalParents: [],
    },
  );

  assert.equal(result.status, "valid");
  assert.equal(result.blocksExamined, 1_000);
  assert.equal(result.edgesExamined, 999);
  assert.deepEqual(result.issues, []);
});

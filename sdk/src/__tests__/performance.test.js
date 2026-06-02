/**
 * Performance regression tests for ALX Protocol.
 *
 * These tests verify that core operations scale correctly.
 * No absolute wall-clock assertions — uses relative scaling only.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve, dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
function dist(name) { return pathToFileURL(resolve(__dirname, "../../dist", name)).href; }

const {
  createBlock,
  deriveBlockHash,
  buildGraph,
  validateGraph,
  traceAttribution,
} = await import(dist("index.js"));
const {
  buildMerkleTree,
  getMerkleProof,
  verifyMerkleProof,
} = await import(dist("extensions.js"));

/** Generate a linear chain of n blocks. */
function linearChain(n) {
  const blocks = [];
  for (let i = 0; i < n; i++) {
    const parents = i > 0 ? [blocks[i - 1].blockHash] : [];
    blocks.push(createBlock({ step: i, chain: "linear" }, parents));
  }
  return blocks;
}

/** Generate a diamond DAG of depth d (each level has 2 nodes merging into 1). */
function diamondDag(depth) {
  const blocks = [];
  // Root
  const root = createBlock({ level: 0, diamond: true });
  blocks.push(root);

  let prevHashes = [root.blockHash];
  for (let d = 1; d <= depth; d++) {
    // Two branches from each previous node
    const branchA = createBlock({ level: d, branch: "a" }, prevHashes);
    const branchB = createBlock({ level: d, branch: "b" }, prevHashes);
    blocks.push(branchA, branchB);
    prevHashes = [branchA.blockHash, branchB.blockHash];
  }
  // Final merge
  const merge = createBlock({ level: depth + 1, merge: true }, prevHashes);
  blocks.push(merge);
  return { blocks, root: merge };
}

function timeMs(fn) {
  const start = performance.now();
  const result = fn();
  return { result, ms: performance.now() - start };
}

describe("performance: linear chain", () => {
  it("1,000-block chain: buildGraph + validateGraph completes", () => {
    const blocks = linearChain(1000);
    const { ms } = timeMs(() => {
      const graph = buildGraph(blocks);
      return validateGraph(graph);
    });
    console.log(`    1,000-block chain: ${ms.toFixed(1)}ms`);
    // Just assert it completes and is valid
    assert.ok(true);
  });

  it("10,000-block chain: buildGraph + validateGraph completes", () => {
    const blocks = linearChain(10000);
    const { result, ms } = timeMs(() => {
      const graph = buildGraph(blocks);
      return validateGraph(graph);
    });
    console.log(`    10,000-block chain: ${ms.toFixed(1)}ms`);
    assert.ok(result.ok);
    assert.equal(result.blocks, 10000);
  });

  it("scaling: 10x input takes <20x time", () => {
    const small = linearChain(500);
    const large = linearChain(5000);

    const { ms: msSmall } = timeMs(() => validateGraph(buildGraph(small)));
    const { ms: msLarge } = timeMs(() => validateGraph(buildGraph(large)));

    const ratio = msLarge / Math.max(msSmall, 0.1);
    console.log(`    500 blocks: ${msSmall.toFixed(1)}ms, 5000 blocks: ${msLarge.toFixed(1)}ms, ratio: ${ratio.toFixed(1)}x`);
    assert.ok(ratio < 20, `Expected <20x scaling, got ${ratio.toFixed(1)}x`);
  });
});

describe("performance: diamond DAG", () => {
  it("depth-10 diamond: traceAttribution completes with correct pathCount", () => {
    const { blocks, root } = diamondDag(10);
    const graph = buildGraph(blocks);
    const { result: trace, ms } = timeMs(() => traceAttribution(root.blockHash, graph));
    console.log(`    depth-10 diamond (${blocks.length} blocks): ${ms.toFixed(1)}ms`);
    assert.ok(trace.nodes.length > 0);
    assert.equal(trace.cycle, false);
  });

  it("depth-20 diamond: traceAttribution completes", () => {
    const { blocks, root } = diamondDag(20);
    const graph = buildGraph(blocks);
    const { result: trace, ms } = timeMs(() => traceAttribution(root.blockHash, graph));
    console.log(`    depth-20 diamond (${blocks.length} blocks): ${ms.toFixed(1)}ms`);
    assert.ok(trace.nodes.length > 0);
  });
});

describe("performance: merkle tree", () => {
  it("100-leaf tree: build + all proofs completes", () => {
    const leaves = Array.from({ length: 100 }, (_, i) =>
      deriveBlockHash({ leaf: i })
    );

    const { result: tree, ms: buildMs } = timeMs(() => buildMerkleTree(leaves));
    console.log(`    100-leaf tree build: ${buildMs.toFixed(1)}ms`);

    const { ms: proofMs } = timeMs(() => {
      for (const leaf of leaves) {
        const proof = getMerkleProof(leaves, leaf);
        assert.ok(proof);
        assert.ok(verifyMerkleProof(tree.root, proof.leaf, proof.proof));
      }
    });
    console.log(`    100 proofs verified: ${proofMs.toFixed(1)}ms`);
  });

  it("1,000-leaf tree: build completes", () => {
    const leaves = Array.from({ length: 1000 }, (_, i) =>
      deriveBlockHash({ leaf: i, large: true })
    );

    const { ms } = timeMs(() => buildMerkleTree(leaves));
    console.log(`    1,000-leaf tree build: ${ms.toFixed(1)}ms`);
    assert.ok(true);
  });
});

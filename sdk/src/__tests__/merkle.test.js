import test from "node:test";
import assert from "node:assert/strict";
import { buildMerkleTree, getMerkleProof, verifyMerkleProof } from "../../dist/merkle.js";
import { deriveBlockHash } from "../../dist/block.js";

// Generate real block hashes for testing
const blocks = ["alpha", "beta", "gamma", "delta", "epsilon"].map((content) => {
  return deriveBlockHash(content, []);
});

// ── buildMerkleTree ──

test("builds tree from single leaf", () => {
  const { root, layers } = buildMerkleTree([blocks[0]]);
  assert.equal(root, blocks[0].toLowerCase());
  assert.equal(layers.length, 1);
});

test("builds tree from two leaves", () => {
  const { root, layers } = buildMerkleTree([blocks[0], blocks[1]]);
  assert.ok(root.startsWith("0x"));
  assert.equal(root.length, 66);
  assert.equal(layers.length, 2);
  assert.equal(layers[0].length, 2);
  assert.equal(layers[1].length, 1);
});

test("builds tree from 5 leaves (odd count)", () => {
  const { root, layers } = buildMerkleTree(blocks);
  assert.ok(root.startsWith("0x"));
  assert.equal(layers[0].length, 5);
});

test("same leaves in different order produce same root", () => {
  const a = buildMerkleTree([blocks[0], blocks[1], blocks[2]]);
  const b = buildMerkleTree([blocks[2], blocks[0], blocks[1]]);
  assert.equal(a.root, b.root);
});

test("different leaves produce different root", () => {
  const a = buildMerkleTree([blocks[0], blocks[1]]);
  const b = buildMerkleTree([blocks[0], blocks[2]]);
  assert.notEqual(a.root, b.root);
});

test("throws on empty array", () => {
  assert.throws(() => buildMerkleTree([]));
});

// ── getMerkleProof ──

test("generates valid proof for each leaf", () => {
  for (const leaf of blocks) {
    const result = getMerkleProof(blocks, leaf);
    assert.ok(result, `proof should exist for ${leaf}`);
    assert.ok(Array.isArray(result.proof));
    assert.equal(result.leaf, leaf.toLowerCase());
  }
});

test("proof verifies against root", () => {
  for (const leaf of blocks) {
    const result = getMerkleProof(blocks, leaf);
    const valid = verifyMerkleProof(result.root, result.leaf, result.proof);
    assert.ok(valid, `proof should verify for ${leaf}`);
  }
});

test("returns null for leaf not in tree", () => {
  const fake = deriveBlockHash("not-in-tree", []);
  const result = getMerkleProof(blocks, fake);
  assert.equal(result, null);
});

// ── verifyMerkleProof ──

test("rejects tampered leaf", () => {
  const result = getMerkleProof(blocks, blocks[0]);
  const tampered = deriveBlockHash("tampered", []);
  const valid = verifyMerkleProof(result.root, tampered, result.proof);
  assert.equal(valid, false);
});

test("rejects tampered proof", () => {
  const result = getMerkleProof(blocks, blocks[0]);
  if (result.proof.length > 0) {
    const tampered = [...result.proof];
    tampered[0] = deriveBlockHash("tampered-sibling", []);
    const valid = verifyMerkleProof(result.root, result.leaf, tampered);
    assert.equal(valid, false);
  }
});

test("single leaf: empty proof verifies", () => {
  const { root } = buildMerkleTree([blocks[0]]);
  const valid = verifyMerkleProof(root, blocks[0], []);
  assert.ok(valid);
});

// ── Conformance: off-chain proof matches on-chain verification ──

test("VECTOR M1: two-leaf tree produces deterministic root and proof", () => {
  const leaves = [blocks[0], blocks[1]];
  const tree = buildMerkleTree(leaves);
  const proof0 = getMerkleProof(leaves, blocks[0]);
  const proof1 = getMerkleProof(leaves, blocks[1]);

  // Both proofs verify
  assert.ok(verifyMerkleProof(tree.root, proof0.leaf, proof0.proof));
  assert.ok(verifyMerkleProof(tree.root, proof1.leaf, proof1.proof));

  // Deterministic: rebuild produces same root
  const tree2 = buildMerkleTree(leaves);
  assert.equal(tree.root, tree2.root);
});

test("VECTOR M2: five-leaf tree — all proofs verify", () => {
  const tree = buildMerkleTree(blocks);
  for (const leaf of blocks) {
    const { proof, root } = getMerkleProof(blocks, leaf);
    assert.equal(root, tree.root);
    assert.ok(verifyMerkleProof(root, leaf, proof));
  }
});

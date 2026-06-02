/**
 * merkle.ts — Sorted-pair Merkle tree for checkpoint proofs.
 *
 * Builds a Merkle tree from an array of block hashes and generates
 * inclusion proofs. The tree uses sorted-pair hashing (same as the
 * on-chain _hashPair in CheckpointRegistry.sol) to ensure canonical
 * tree construction — same leaves always produce the same root.
 *
 * This is the off-chain complement to CheckpointRegistry.verifyInclusion.
 */

import { ErrorCode, protocolError } from "./errors.js";
import { hexToBytes, concatBytes } from "./hash-utils.js";
import sha3pkg from "js-sha3";
const { keccak_256 } = sha3pkg;

/** A Merkle tree with root hash and intermediate layers. */
export interface MerkleTree {
  root: string;
  layers: string[][];
}

/** A Merkle inclusion proof. */
export interface MerkleProof {
  proof: string[];
  root: string;
  leaf: string;
  index: number;
}

/**
 * Hash a sorted pair of 32-byte values (matches Solidity _hashPair).
 */
function hashPair(a: string, b: string): string {
  const aBuf = hexToBytes(a.slice(2));
  const bBuf = hexToBytes(b.slice(2));
  // Sort: smaller value first (matches Solidity a < b comparison)
  const concat = a.toLowerCase() < b.toLowerCase()
    ? concatBytes(aBuf, bBuf)
    : concatBytes(bBuf, aBuf);
  return "0x" + keccak_256(concat);
}

/**
 * Build a Merkle tree from an array of block hashes.
 */
export function buildMerkleTree(leaves: string[]): MerkleTree {
  if (!Array.isArray(leaves) || leaves.length === 0) {
    throw protocolError(ErrorCode.EMPTY_LEAVES, "leaves must be a non-empty array");
  }

  // Normalize, validate, and sort leaves for canonical ordering
  const hashPattern = /^0x[a-f0-9]{64}$/;
  const sorted = [...leaves]
    .map((h) => {
      const normalized = h.toLowerCase().trim();
      if (!hashPattern.test(normalized)) {
        throw protocolError(ErrorCode.INVALID_LEAF_HASH, `invalid leaf hash: ${h}`);
      }
      return normalized;
    })
    .sort();

  let layer = [...sorted];
  const layers: string[][] = [layer];

  while (layer.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < layer.length; i += 2) {
      if (i + 1 < layer.length) {
        next.push(hashPair(layer[i], layer[i + 1]));
      } else {
        // Odd leaf: promote to next level
        next.push(layer[i]);
      }
    }
    layer = next;
    layers.push(layer);
  }

  return {
    root: layer[0],
    layers,
  };
}

/**
 * Generate a Merkle inclusion proof for a specific leaf.
 */
export function getMerkleProof(leaves: string[], leaf: string): MerkleProof | null {
  const { root, layers } = buildMerkleTree(leaves);
  const target = leaf.toLowerCase();
  let index = layers[0].indexOf(target);
  if (index === -1) return null;

  const proof: string[] = [];
  for (let i = 0; i < layers.length - 1; i++) {
    const layerLen = layers[i].length;
    const siblingIndex = index % 2 === 0 ? index + 1 : index - 1;
    if (siblingIndex < layerLen) {
      proof.push(layers[i][siblingIndex]);
    }
    index = Math.floor(index / 2);
  }

  return { proof, root, leaf: target, index: layers[0].indexOf(target) };
}

/**
 * Verify a Merkle proof off-chain (mirrors CheckpointRegistry.verifyProof).
 */
export function verifyMerkleProof(root: string, leaf: string, proof: string[]): boolean {
  let hash = leaf.toLowerCase();
  for (const sibling of proof) {
    hash = hashPair(hash, sibling);
  }
  return hash === root.toLowerCase();
}

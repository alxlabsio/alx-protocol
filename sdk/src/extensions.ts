/**
 * Optional ALX extension surface.
 *
 * Core ALX conformance does not require these functions. Import them
 * explicitly when an application chooses to support an optional extension.
 */

export {
  buildMerkleTree,
  getMerkleProof,
  verifyMerkleProof,
} from "./merkle.js";

export type { MerkleTree, MerkleProof } from "./merkle.js";

import { normalizeHash, validateBlock } from "@alx-protocol/sdk";
import type { Block } from "@alx-protocol/sdk";

/** Storage-facing metadata for one locally available Block. */
export interface BlockSummary {
  blockHash: string;
  contentHash: string;
  parentHashes: string[];
  protocolVersion: "1";
}

/** Non-normative application interface for local Block persistence. */
export interface BlockStore {
  put(block: Block): Promise<void>;
  get(blockHash: string): Promise<Block | null>;
  list(): Promise<BlockSummary[]>;
  has(blockHash: string): Promise<boolean>;
  remove(blockHash: string): Promise<void>;
}

export function assertValidStoredBlock(block: Block): void {
  const result = validateBlock(block);
  if (!result.ok) {
    throw new Error(`Refusing to store invalid Block: ${block?.blockHash ?? "missing blockHash"}`);
  }
}

export function normalizeStoreKey(blockHash: string): string {
  return normalizeHash(blockHash);
}

export function summarizeBlock(block: Block): BlockSummary {
  return {
    blockHash: block.blockHash,
    contentHash: block.contentHash,
    parentHashes: [...block.parentHashes],
    protocolVersion: block.protocolVersion,
  };
}

export function cloneBlock(block: Block): Block {
  return structuredClone(block);
}

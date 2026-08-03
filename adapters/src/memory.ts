import type { Block } from "@alx-protocol/sdk";
import type { BlockStore, BlockSummary } from "./block-store.js";
import {
  assertValidStoredBlock,
  cloneBlock,
  normalizeStoreKey,
  summarizeBlock,
} from "./block-store.js";

/** Process-local Block storage intended for tests and ephemeral applications. */
export class MemoryBlockStore implements BlockStore {
  private readonly blocks = new Map<string, Block>();

  async put(block: Block): Promise<void> {
    assertValidStoredBlock(block);
    this.blocks.set(normalizeStoreKey(block.blockHash), cloneBlock(block));
  }

  async get(blockHash: string): Promise<Block | null> {
    const block = this.blocks.get(normalizeStoreKey(blockHash));
    return block ? cloneBlock(block) : null;
  }

  async list(): Promise<BlockSummary[]> {
    return [...this.blocks.values()]
      .map(summarizeBlock)
      .sort((left, right) => left.blockHash.localeCompare(right.blockHash));
  }

  async has(blockHash: string): Promise<boolean> {
    return this.blocks.has(normalizeStoreKey(blockHash));
  }

  async remove(blockHash: string): Promise<void> {
    this.blocks.delete(normalizeStoreKey(blockHash));
  }
}

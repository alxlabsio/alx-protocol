import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseStrictJsonBytes, type Block } from "@alx-protocol/sdk";
import type { BlockStore, BlockSummary } from "./block-store.js";
import { assertValidStoredBlock, normalizeStoreKey, summarizeBlock } from "./block-store.js";

const FILE_SUFFIX = ".block.json";

/** Filesystem-backed local store with one content-addressed JSON file per Block. */
export class FileBlockStore implements BlockStore {
  readonly directory: string;

  constructor(directory: string) {
    this.directory = resolve(directory);
  }

  private pathFor(blockHash: string): string {
    return join(this.directory, `${normalizeStoreKey(blockHash)}${FILE_SUFFIX}`);
  }

  async put(block: Block): Promise<void> {
    assertValidStoredBlock(block);
    await mkdir(this.directory, { recursive: true });
    const path = this.pathFor(block.blockHash);
    const temporary = `${path}.${process.pid}.${crypto.randomUUID()}.tmp`;
    try {
      await writeFile(temporary, `${JSON.stringify(block, null, 2)}\n`, "utf8");
      await rename(temporary, path);
    } finally {
      await rm(temporary, { force: true });
    }
  }

  async get(blockHash: string): Promise<Block | null> {
    try {
      const block = parseStrictJsonBytes(await readFile(this.pathFor(blockHash))) as Block;
      assertValidStoredBlock(block);
      return block;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  async list(): Promise<BlockSummary[]> {
    let entries: string[];
    try {
      entries = await readdir(this.directory);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
    const summaries: BlockSummary[] = [];
    for (const entry of entries.filter((name) => name.endsWith(FILE_SUFFIX)).sort()) {
      const blockHash = entry.slice(0, -FILE_SUFFIX.length);
      const block = await this.get(blockHash);
      if (block) summaries.push(summarizeBlock(block));
    }
    return summaries;
  }

  async has(blockHash: string): Promise<boolean> {
    return (await this.get(blockHash)) !== null;
  }

  async remove(blockHash: string): Promise<void> {
    await rm(this.pathFor(blockHash), { force: true });
  }
}

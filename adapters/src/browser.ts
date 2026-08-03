import type { Block } from "@alx-protocol/sdk";
import type { BlockStore, BlockSummary } from "./block-store.js";
import { assertValidStoredBlock, cloneBlock, normalizeStoreKey, summarizeBlock } from "./block-store.js";

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

/** IndexedDB-backed local Block storage for browser applications. */
export class BrowserBlockStore implements BlockStore {
  private readonly database: Promise<IDBDatabase>;
  private readonly storeName: string;

  constructor(databaseName = "alx-local-block-store", storeName = "blocks") {
    this.storeName = storeName;
    this.database = new Promise((resolve, reject) => {
      const request = indexedDB.open(databaseName, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(storeName)) {
          request.result.createObjectStore(storeName, { keyPath: "blockHash" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Unable to open IndexedDB"));
    });
  }

  private async store(mode: IDBTransactionMode): Promise<IDBObjectStore> {
    return (await this.database).transaction(this.storeName, mode).objectStore(this.storeName);
  }

  async put(block: Block): Promise<void> {
    assertValidStoredBlock(block);
    await requestResult((await this.store("readwrite")).put(cloneBlock(block)));
  }

  async get(blockHash: string): Promise<Block | null> {
    const block = await requestResult((await this.store("readonly")).get(normalizeStoreKey(blockHash))) as Block | undefined;
    if (!block) return null;
    assertValidStoredBlock(block);
    return cloneBlock(block);
  }

  async list(): Promise<BlockSummary[]> {
    const blocks = await requestResult((await this.store("readonly")).getAll()) as Block[];
    for (const block of blocks) assertValidStoredBlock(block);
    return blocks.map(summarizeBlock).sort((left, right) => left.blockHash.localeCompare(right.blockHash));
  }

  async has(blockHash: string): Promise<boolean> {
    const key = await requestResult((await this.store("readonly")).getKey(normalizeStoreKey(blockHash)));
    return key !== undefined;
  }

  async remove(blockHash: string): Promise<void> {
    await requestResult((await this.store("readwrite")).delete(normalizeStoreKey(blockHash)));
  }
}

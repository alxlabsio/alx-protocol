import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { createBlock } from "@alx-protocol/sdk";
import { MemoryBlockStore } from "../dist/index.js";
import { FileBlockStore } from "../dist/file.js";

async function exerciseStore(store) {
  const parent = createBlock({ type: "market.research", sector: "energy" }, []);
  const report = createBlock({ type: "market.report", finding: "Demand increased" }, [parent.blockHash]);

  await store.put(report);
  await store.put(parent);
  assert.equal(await store.has(report.blockHash), true);
  assert.deepEqual(await store.get(report.blockHash), report);
  assert.deepEqual((await store.list()).map((item) => item.blockHash), [parent.blockHash, report.blockHash].sort());

  await store.remove(parent.blockHash);
  assert.equal(await store.has(parent.blockHash), false);
  assert.deepEqual(await store.get(report.blockHash), report);
}

describe("MemoryBlockStore", () => {
  it("stores, lists, and removes Blocks without interpreting their Graph", async () => {
    await exerciseStore(new MemoryBlockStore());
  });

  it("rejects a Block whose stored identity is invalid", async () => {
    const store = new MemoryBlockStore();
    const block = createBlock({ type: "compliance.review", result: "approved" }, []);
    await assert.rejects(() => store.put({ ...block, content: { ...block.content, result: "rejected" } }));
  });
});

describe("FileBlockStore", () => {
  it("persists complete Blocks in a local directory", async () => {
    const directory = await mkdtemp(join(tmpdir(), "alx-file-store-"));
    try {
      await exerciseStore(new FileBlockStore(directory));
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

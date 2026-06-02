import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startRetrievalServer } from "../server/retrieval-server.js";
import { createRetrievalStore } from "../lib/retrieval-store.js";
import sdk from "../lib/sdk.js";

const { createBlock } = sdk;

let port;
let baseUrl;
let dataDir;
let server;

before(async () => {
  dataDir = mkdtempSync(join(tmpdir(), "alx-retrieval-test-"));
  port = 18000 + Math.floor(Math.random() * 1000);
  server = await startRetrievalServer(port, {
    dataDir,
    gateway: "https://ipfs.example/ipfs",
  });
  baseUrl = `http://127.0.0.1:${port}`;
});

after(() => {
  server.close();
  rmSync(dataDir, { recursive: true, force: true });
});

function sampleBlock() {
  return createBlock(
    {
      type: "ai.response",
      text: "Market analysis complete for Q2 semiconductor supply chain review.",
    },
    [],
  );
}

test("POST /block then GET /block returns verified block", async () => {
  const block = sampleBlock();

  const postRes = await fetch(`${baseUrl}/block`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(block),
  });
  assert.equal(postRes.status, 201);
  const postBody = await postRes.json();
  assert.equal(postBody.blockHash, block.blockHash);

  const getRes = await fetch(`${baseUrl}/block/${block.blockHash}`);
  assert.equal(getRes.status, 200);
  const getBody = await getRes.json();
  assert.equal(getBody.block.blockHash, block.blockHash);
  assert.equal(getBody.source, "local");

  const headRes = await fetch(`${baseUrl}/block/${block.blockHash}`, { method: "HEAD" });
  assert.equal(headRes.status, 200);
});

test("invalid blockHash returns 400", async () => {
  const res = await fetch(`${baseUrl}/block/not-a-hash`);
  assert.equal(res.status, 400);
});

test("tampered block rejected on POST", async () => {
  const block = sampleBlock();
  block.blockHash = "0x" + "a".repeat(64);

  const res = await fetch(`${baseUrl}/block`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(block),
  });
  assert.equal(res.status, 400);

  const store = createRetrievalStore(dataDir);
  assert.equal(store.hasBlock(block.blockHash), false);
});

test("POST /blocks batch returns partial hits and missing", async () => {
  const block = sampleBlock();
  await fetch(`${baseUrl}/block`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(block),
  });

  const missingHash = "0x" + "b".repeat(64);
  const res = await fetch(`${baseUrl}/blocks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blockHashes: [block.blockHash, missingHash] }),
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.blocks.length, 1);
  assert.deepEqual(body.missing, [missingHash]);
});

test("publish envelope stores CID and GET /cid returns gatewayUrl", async () => {
  const block = createBlock(
    {
      type: "ai.response",
      text: "Compliance audit trail checkpoint for vendor security review.",
    },
    [],
  );
  const cid = "bafybeigdyrzt5k5xqk7j5xqk7j5xqk7j5xqk7j5xqk7j5xqk7j5xqk7j5xq";

  const postRes = await fetch(`${baseUrl}/block`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ block, cid }),
  });
  assert.equal(postRes.status, 201);

  const cidRes = await fetch(`${baseUrl}/block/${block.blockHash}/cid`);
  assert.equal(cidRes.status, 200);
  const cidBody = await cidRes.json();
  assert.equal(cidBody.cid, cid);
  assert.equal(cidBody.gatewayUrl, `https://ipfs.example/ipfs/${cid}`);
});

test("store persists across new store instance", async () => {
  const block = createBlock(
    {
      type: "ai.response",
      text: "Multi-vendor agent handoff summary for marketplace security review.",
    },
    [],
  );

  await fetch(`${baseUrl}/block`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(block),
  });

  const store = createRetrievalStore(dataDir);
  const loaded = store.getBlock(block.blockHash);
  assert.equal(loaded.blockHash, block.blockHash);
});

test("duplicate identical POST returns 200", async () => {
  const block = sampleBlock();

  const first = await fetch(`${baseUrl}/block`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(block),
  });
  assert.ok(first.status === 201 || first.status === 200);

  const second = await fetch(`${baseUrl}/block`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(block),
  });
  assert.equal(second.status, 200);
});

test("store putBlock returns conflict when bytes differ at same path", () => {
  const block = createBlock(
    {
      type: "ai.response",
      text: "First version of policy-constrained agent response.",
    },
    [],
  );
  const conflictDir = mkdtempSync(join(tmpdir(), "alx-retrieval-conflict-"));
  try {
    const store = createRetrievalStore(conflictDir);
    store.putBlock(block);
    const other = createBlock(
      {
        type: "ai.response",
        text: "Second version stored under the same filename (corrupt index).",
      },
      [],
    );
    writeFileSync(join(conflictDir, "blocks", `${block.blockHash}.json`), JSON.stringify(other));
    assert.throws(
      () => store.putBlock(block),
      (err) => err.code === "CONFLICT",
    );
  } finally {
    rmSync(conflictDir, { recursive: true, force: true });
  }
});

test("GET /health returns ok", async () => {
  const res = await fetch(`${baseUrl}/health`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, "ok");
});

test("write auth and rate limit when guard env is configured", async () => {
  const guardDir = mkdtempSync(join(tmpdir(), "alx-retrieval-guard-"));
  const guardPort = 19000 + Math.floor(Math.random() * 500);
  const guardServer = await startRetrievalServer(guardPort, {
    dataDir: guardDir,
    env: {
      ALX_RETRIEVAL_API_KEY: "test-secret",
      ALX_RETRIEVAL_RATE_LIMIT: "10",
      ALX_RETRIEVAL_RATE_WINDOW_MS: "60000",
    },
  });
  const guardBase = `http://127.0.0.1:${guardPort}`;
  const block = sampleBlock();

  const denied = await fetch(`${guardBase}/block`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(block),
  });
  assert.equal(denied.status, 401);

  const allowed = await fetch(`${guardBase}/block`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer test-secret",
    },
    body: JSON.stringify(block),
  });
  assert.equal(allowed.status, 201);

  const read = await fetch(`${guardBase}/block/${block.blockHash}`);
  assert.equal(read.status, 200);

  const tinyDir = mkdtempSync(join(tmpdir(), "alx-retrieval-ratelimit-"));
  const tinyPort = 19500 + Math.floor(Math.random() * 100);
  const tinyServer = await startRetrievalServer(tinyPort, {
    dataDir: tinyDir,
    env: { ALX_RETRIEVAL_RATE_LIMIT: "2", ALX_RETRIEVAL_RATE_WINDOW_MS: "60000" },
  });
  const tinyBase = `http://127.0.0.1:${tinyPort}`;
  const rateBlock = sampleBlock();
  const body = JSON.stringify(rateBlock);
  const postOpts = { method: "POST", headers: { "Content-Type": "application/json" }, body };
  await fetch(`${tinyBase}/block`, postOpts);
  await fetch(`${tinyBase}/block`, postOpts);
  const limited = await fetch(`${tinyBase}/block`, postOpts);
  assert.equal(limited.status, 429);
  tinyServer.close();
  rmSync(tinyDir, { recursive: true, force: true });

  guardServer.close();
  rmSync(guardDir, { recursive: true, force: true });
});

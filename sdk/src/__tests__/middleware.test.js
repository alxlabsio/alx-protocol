/**
 * Tests for middleware.ts (compiled: dist/middleware.js)
 *
 * MW-1  Proxy pass-through — non-intercepted props/methods unchanged
 * MW-2  Streaming intercept — locks on "message" event; stream._alx resolves
 * MW-3  Side-effect error isolation — onLock/persist errors do not propagate
 * MW-4  Deterministic clock injection via `now` option
 * MW-5  Bounded history with eviction + onEvict hook
 * MW-7  Return type extends original — response carries _alx
 * MW-8  Underlying client called with unmodified params
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { alxMiddleware, lockBind } from "../../dist/middleware.js";
import { validateBlock } from "../../dist/block.js";

// ── Fake client helpers ───────────────────────────────────────────────────────

function makeClient(responseOverrides = {}) {
  const calls = [];
  const client = {
    messages: {
      create: async (params) => {
        calls.push(params);
        return {
          content: [{ type: "text", text: "Test response" }],
          model: "claude-sonnet-4-6",
          stop_reason: "end_turn",
          usage: { input_tokens: 10, output_tokens: 5 },
          ...responseOverrides,
        };
      },
      otherMethod: () => "passthrough",
    },
    otherProp: "should-pass-through",
    calls,
  };
  return client;
}

/**
 * Fake messages.stream() — returns an EventEmitter that emits "message"
 * on the next tick (simulating Anthropic SDK MessageStream behaviour).
 */
function makeStreamClient(finalMessage = {}) {
  const streamCalls = [];
  const client = {
    messages: {
      create: async () => ({ content: [], model: "m" }),
      stream: (params) => {
        streamCalls.push(params);
        const emitter = new EventEmitter();
        const msg = {
          content: [{ type: "text", text: "Streamed response" }],
          model: "claude-sonnet-4-6",
          stop_reason: "end_turn",
          usage: { input_tokens: 8, output_tokens: 4 },
          ...finalMessage,
        };
        // Emit on next tick so callers can attach listeners first
        setImmediate(() => emitter.emit("message", msg));
        // Minimal async iterator for completeness
        emitter[Symbol.asyncIterator] = async function* () { yield* []; };
        return emitter;
      },
    },
    streamCalls,
  };
  return client;
}

// ── alxMiddleware — messages.create ──────────────────────────────────────────

describe("alxMiddleware — messages.create", () => {
  it("passes params to underlying client unchanged (MW-8)", async () => {
    const client = makeClient();
    const wrapped = alxMiddleware(client);
    const params = { model: "claude-sonnet-4-6", messages: [{ role: "user", content: "Hello" }], max_tokens: 100 };
    await wrapped.messages.create(params);
    assert.equal(client.calls.length, 1);
    assert.deepEqual(client.calls[0], params);
  });

  it("returns valid linked blocks on response._alx (MW-7)", async () => {
    const client = makeClient();
    const wrapped = alxMiddleware(client);
    const msg = await wrapped.messages.create({
      model: "claude-sonnet-4-6",
      messages: [{ role: "user", content: "Analyze trends" }],
    });
    const { promptBlock, responseBlock } = msg._alx;
    assert.ok(validateBlock(promptBlock).ok, "promptBlock invalid");
    assert.ok(validateBlock(responseBlock).ok, "responseBlock invalid");
    assert.deepEqual(responseBlock.parentHashes, [promptBlock.blockHash]);
    assert.equal(promptBlock.content.type, "ai.prompt");
    assert.equal(responseBlock.content.type, "ai.response");
    assert.equal(msg._alx.via, "create");
  });

  it("accumulates history", async () => {
    const client = makeClient();
    const wrapped = alxMiddleware(client);
    await wrapped.messages.create({ model: "m", messages: [] });
    await wrapped.messages.create({ model: "m", messages: [] });
    assert.equal(wrapped._alx.history.length, 2);
  });

  it("evicts oldest entries when maxHistory is reached (MW-5)", async () => {
    const client = makeClient();
    const wrapped = alxMiddleware(client, { maxHistory: 3 });
    for (let i = 0; i < 5; i++) {
      await wrapped.messages.create({ model: "m", messages: [] });
    }
    assert.equal(wrapped._alx.history.length, 3);
  });

  it("evicted entry is the oldest, not the newest (MW-5)", async () => {
    const client = makeClient();
    const wrapped = alxMiddleware(client, { maxHistory: 2 });
    const first = (await wrapped.messages.create({ model: "m", messages: [{ role: "user", content: "first" }] }))._alx;
    await wrapped.messages.create({ model: "m", messages: [] });
    await wrapped.messages.create({ model: "m", messages: [] });
    const hashes = wrapped._alx.history.map(p => p.promptBlock.blockHash);
    assert.ok(!hashes.includes(first.promptBlock.blockHash), "oldest entry should be evicted");
  });

  it("calls onEvict with evicted pair before removal (MW-5)", async () => {
    const client = makeClient();
    const evicted = [];
    const wrapped = alxMiddleware(client, {
      maxHistory: 2,
      onEvict: (pair) => evicted.push(pair),
    });
    const first = (await wrapped.messages.create({ model: "m", messages: [{ role: "user", content: "first" }] }))._alx;
    await wrapped.messages.create({ model: "m", messages: [] });
    await wrapped.messages.create({ model: "m", messages: [] });
    assert.equal(evicted.length, 1);
    assert.equal(evicted[0].promptBlock.blockHash, first.promptBlock.blockHash);
  });

  it("does not propagate onLock errors to caller (MW-3)", async () => {
    const client = makeClient();
    const errors = [];
    const wrapped = alxMiddleware(client, {
      onLock: async () => { throw new Error("lock error"); },
      onError: (err) => errors.push(err),
    });
    const msg = await wrapped.messages.create({ model: "m", messages: [] });
    assert.ok(msg._alx.responseBlock.blockHash, "response still has block");
    assert.equal(errors.length, 1);
    assert.ok(errors[0].message.includes("lock error"));
  });

  it("does not propagate onEvict errors to caller (MW-3)", async () => {
    const client = makeClient();
    const errors = [];
    const wrapped = alxMiddleware(client, {
      maxHistory: 1,
      onEvict: async () => { throw new Error("evict error"); },
      onError: (err) => errors.push(err),
    });
    await wrapped.messages.create({ model: "m", messages: [] });
    await wrapped.messages.create({ model: "m", messages: [] });
    assert.equal(errors.length, 1);
    assert.ok(errors[0].message.includes("evict error"));
  });

  it("calls onLock with the locked pair", async () => {
    const client = makeClient();
    const pairs = [];
    const wrapped = alxMiddleware(client, { onLock: async (p) => pairs.push(p) });
    await wrapped.messages.create({ model: "m", messages: [] });
    assert.equal(pairs.length, 1);
    assert.ok(pairs[0].promptBlock);
    assert.ok(pairs[0].responseBlock);
  });

  it("uses injected now for deterministic timestamps (MW-4)", async () => {
    const client = makeClient();
    const fixed = "2026-01-01T00:00:00.000Z";
    const wrapped = alxMiddleware(client, { now: () => fixed });
    const msg = await wrapped.messages.create({ model: "m", messages: [] });
    assert.equal(msg._alx.at, fixed);
  });

  it("proxies non-intercepted properties through unchanged (MW-1)", () => {
    const client = makeClient();
    const wrapped = alxMiddleware(client);
    assert.equal(wrapped.otherProp, "should-pass-through");
    assert.equal(wrapped.messages.otherMethod(), "passthrough");
  });

  it("merges promptMeta and responseMeta into block content", async () => {
    const client = makeClient();
    const wrapped = alxMiddleware(client, {
      promptMeta: { pipeline: "q4" },
      responseMeta: { reviewer: "audit" },
    });
    const msg = await wrapped.messages.create({ model: "m", messages: [] });
    assert.equal(msg._alx.promptBlock.content.pipeline, "q4");
    assert.equal(msg._alx.responseBlock.content.reviewer, "audit");
  });

  it("joins multiple text content blocks into one string", async () => {
    const client = makeClient({ content: [{ type: "text", text: "Part one. " }, { type: "text", text: "Part two." }] });
    const wrapped = alxMiddleware(client);
    const msg = await wrapped.messages.create({ model: "m", messages: [] });
    assert.equal(msg._alx.responseBlock.content.text, "Part one. Part two.");
  });
});

// ── alxMiddleware — messages.stream ──────────────────────────────────────────

describe("alxMiddleware — messages.stream (MW-2)", () => {
  it("stream._alx resolves to a valid LockedBind", async () => {
    const client = makeStreamClient();
    const wrapped = alxMiddleware(client);
    const stream = wrapped.messages.stream({ model: "claude-sonnet-4-6", messages: [] });
    const pair = await stream._alx;

    assert.ok(validateBlock(pair.promptBlock).ok, "promptBlock invalid");
    assert.ok(validateBlock(pair.responseBlock).ok, "responseBlock invalid");
    assert.deepEqual(pair.responseBlock.parentHashes, [pair.promptBlock.blockHash]);
    assert.equal(pair.via, "stream");
  });

  it("stream response block is a child of prompt block", async () => {
    const client = makeStreamClient();
    const wrapped = alxMiddleware(client);
    const stream = wrapped.messages.stream({ model: "m", messages: [] });
    const { promptBlock, responseBlock } = await stream._alx;
    assert.deepEqual(responseBlock.parentHashes, [promptBlock.blockHash]);
  });

  it("stream pair is added to history", async () => {
    const client = makeStreamClient();
    const wrapped = alxMiddleware(client);
    const stream = wrapped.messages.stream({ model: "m", messages: [] });
    await stream._alx;
    assert.equal(wrapped._alx.history.length, 1);
    assert.equal(wrapped._alx.history[0].via, "stream");
  });

  it("stream._alx rejects on stream error", async () => {
    const streamCalls = [];
    const client = {
      messages: {
        create: async () => ({ content: [], model: "m" }),
        stream: (params) => {
          streamCalls.push(params);
          const emitter = new EventEmitter();
          emitter[Symbol.asyncIterator] = async function* () { yield* []; };
          setImmediate(() => emitter.emit("error", new Error("network failure")));
          return emitter;
        },
      },
    };
    const wrapped = alxMiddleware(client);
    const stream = wrapped.messages.stream({ model: "m", messages: [] });
    await assert.rejects(() => stream._alx, /network failure/);
  });

  it("stream passes params to underlying client unchanged (MW-8)", async () => {
    const client = makeStreamClient();
    const wrapped = alxMiddleware(client);
    const params = { model: "claude-sonnet-4-6", messages: [{ role: "user", content: "hello" }] };
    const stream = wrapped.messages.stream(params);
    await stream._alx;
    assert.deepEqual(client.streamCalls[0], params);
  });

  it("stream onLock errors do not propagate (MW-3)", async () => {
    const client = makeStreamClient();
    const errors = [];
    const wrapped = alxMiddleware(client, {
      onLock: async () => { throw new Error("stream lock error"); },
      onError: (err) => errors.push(err),
    });
    const stream = wrapped.messages.stream({ model: "m", messages: [] });
    // _alx resolves even when onLock throws
    await stream._alx;
    assert.equal(errors.length, 1);
    assert.ok(errors[0].message.includes("stream lock error"));
  });

  it("stream uses injected now (MW-4)", async () => {
    const client = makeStreamClient();
    const fixed = "2026-06-15T10:00:00.000Z";
    const wrapped = alxMiddleware(client, { now: () => fixed });
    const stream = wrapped.messages.stream({ model: "m", messages: [] });
    const pair = await stream._alx;
    assert.equal(pair.at, fixed);
  });

  it("stream proxy passes non-intercepted properties through (MW-1)", async () => {
    const client = makeStreamClient();
    const wrapped = alxMiddleware(client);
    const stream = wrapped.messages.stream({ model: "m", messages: [] });
    await stream._alx;
    // Symbol.asyncIterator must still be present
    assert.ok(typeof stream[Symbol.asyncIterator] === "function");
  });
});

// ── lockBind ─────────────────────────────────────────────────────────────────

describe("lockBind", () => {
  it("produces valid linked blocks", () => {
    const pair = lockBind(
      { content: "What is 2+2?", model: "claude-sonnet-4-6" },
      { text: "4", model: "claude-sonnet-4-6" },
    );
    assert.ok(validateBlock(pair.promptBlock).ok);
    assert.ok(validateBlock(pair.responseBlock).ok);
    assert.deepEqual(pair.responseBlock.parentHashes, [pair.promptBlock.blockHash]);
  });

  it("accepts injected at timestamp (MW-4)", () => {
    const fixed = "2026-06-01T12:00:00.000Z";
    const pair = lockBind({ content: "hello" }, { text: "world" }, { at: fixed });
    assert.equal(pair.at, fixed);
  });

  it("same inputs + same at produce identical block hashes (deterministic)", () => {
    const at = "2026-01-01T00:00:00.000Z";
    const p1 = lockBind({ content: "q" }, { text: "a" }, { at });
    const p2 = lockBind({ content: "q" }, { text: "a" }, { at });
    assert.equal(p1.promptBlock.blockHash, p2.promptBlock.blockHash);
    assert.equal(p1.responseBlock.blockHash, p2.responseBlock.blockHash);
  });

  it("meta is merged into both blocks", () => {
    const pair = lockBind({ content: "q" }, { text: "a" }, { meta: { source: "test" } });
    assert.equal(pair.promptBlock.content.source, "test");
    assert.equal(pair.responseBlock.content.source, "test");
  });

  it("via is always 'create'", () => {
    const pair = lockBind({ content: "q" }, { text: "a" });
    assert.equal(pair.via, "create");
  });
});

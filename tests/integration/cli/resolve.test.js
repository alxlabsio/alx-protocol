import assert from "node:assert/strict";
import test from "node:test";

import { createBlock } from "../../../sdk/dist/index.js";
import { resolveBlock } from "../../../cli/lib/resolve.js";

test("HTTP Block resolution strictly decodes and validates received response bytes", async (t) => {
  const block = createBlock({ type: "http.boundary" }, []);
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const response = (body) => ({
    ok: true,
    arrayBuffer: async () => {
      const bytes = typeof body === "string" ? new TextEncoder().encode(body) : body;
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    },
  });

  globalThis.fetch = async () => response(JSON.stringify({ block }));
  assert.deepEqual(
    (await resolveBlock(block.blockHash, { endpoint: "https://retrieval.example" }))?.block,
    block,
  );

  const duplicate = JSON.stringify({ block }).replace(
    /^{/,
    `{"block":${JSON.stringify(block)},`,
  );
  globalThis.fetch = async () => response(duplicate);
  assert.equal(await resolveBlock(block.blockHash, { endpoint: "https://retrieval.example" }), null);

  globalThis.fetch = async () => response(Uint8Array.from([0xff]));
  assert.equal(await resolveBlock(block.blockHash, { endpoint: "https://retrieval.example" }), null);

  globalThis.fetch = async () => response(JSON.stringify({ block: { ...block, unexpected: true } }));
  assert.equal(await resolveBlock(block.blockHash, { endpoint: "https://retrieval.example" }), null);
});

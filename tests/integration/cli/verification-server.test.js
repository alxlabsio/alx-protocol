import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { startServer } from "../../../cli/server/server.js";

function request(url, options = {}) {
  return fetch(url, { ...options, signal: options.signal ?? AbortSignal.timeout(5_000) });
}

describe("verification server routes", () => {
  let server;
  let baseUrl;

  before(async () => {
    server = await startServer(0);
    const address = server.address();
    assert.ok(address && typeof address === "object");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    if (!server) return;
    await new Promise((resolvePromise, reject) => {
      server.close((error) => error ? reject(error) : resolvePromise());
    });
  });

  it("serves health, version, and the supported OpenAPI contract", async () => {
    const healthResponse = await request(baseUrl + "/health");
    assert.equal(healthResponse.status, 200);
    const health = await healthResponse.json();
    assert.equal(health.status, "ok");
    assert.equal(health.implementation, "typescript-reference");

    const versionResponse = await request(baseUrl + "/version");
    assert.equal(versionResponse.status, 200);
    const version = await versionResponse.json();
    assert.equal(version.protocol, health.protocolVersion);

    const openApiResponse = await request(baseUrl + "/openapi.yaml");
    assert.equal(openApiResponse.status, 200);
    const openApi = await openApiResponse.text();
    assert.match(openApi, /\/block\/create:/);
    assert.match(openApi, /\/block\/validate:/);
    assert.doesNotMatch(openApi, /^ {2}\/validate:/m);
    assert.doesNotMatch(openApi, /\/test-vectors\/run:/);
  });

  it("creates, validates, and traces a Block through canonical routes", async () => {
    const createResponse = await request(baseUrl + "/block/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: { type: "analysis", text: "Verification server route coverage" },
        parentHashes: [],
      }),
    });
    assert.equal(createResponse.status, 200);
    const block = await createResponse.json();
    assert.match(block.blockHash, /^0x[a-f0-9]{64}$/);

    const validateResponse = await request(baseUrl + "/block/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(block),
    });
    assert.equal(validateResponse.status, 200);
    const validation = await validateResponse.json();
    assert.equal(validation.valid, true);

    const traceResponse = await request(baseUrl + "/trace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ root: block.blockHash, graph: { [block.blockHash]: [] } }),
    });
    assert.equal(traceResponse.status, 200);
    const trace = await traceResponse.json();
    assert.equal(trace.root, block.blockHash);
    assert.equal(trace.nodes.length, 1);
  });

  it("rejects lossy or duplicate-member raw JSON before route processing", async () => {
    const duplicate = await request(baseUrl + "/block/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: '{"content":null,"content":{"replaced":true},"parentHashes":[]}',
    });
    assert.equal(duplicate.status, 400);

    const malformedUtf8 = await request(baseUrl + "/block/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: Uint8Array.from([0xff]),
    });
    assert.equal(malformedUtf8.status, 400);
  });

  it("does not expose the retired partial conformance endpoint", async () => {
    const response = await request(baseUrl + "/test-vectors/run", { method: "POST" });
    assert.equal(response.status, 404);
    const body = await response.json();
    assert.match(body.error, /Not found: POST \/test-vectors\/run/);
  });

  it("does not expose the retired /validate alias", async () => {
    const response = await request(baseUrl + "/validate", { method: "POST" });
    assert.equal(response.status, 404);
    const body = await response.json();
    assert.match(body.error, /Not found: POST \/validate/);
  });
});

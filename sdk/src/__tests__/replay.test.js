import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve, dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
function dist(name) { return pathToFileURL(resolve(__dirname, "../../dist", name)).href; }

const { buildReplayScopeKey, validateReplayWindow } = await import(dist("replay.js"));

describe("buildReplayScopeKey", () => {
  it("builds a scoped key with all components", () => {
    const key = buildReplayScopeKey({ actor: "0xabc", nonce: "n1", chainId: 1, domain: "app" });
    assert.ok(key.includes("0xabc"));
    assert.ok(key.includes("n1"));
    assert.ok(key.includes("1"));
    assert.ok(key.includes("app"));
  });

  it("uses null-byte separator to prevent collision", () => {
    const key1 = buildReplayScopeKey({ actor: "alice:bob", nonce: "n1", chainId: 1, domain: "d" });
    const key2 = buildReplayScopeKey({ actor: "alice", nonce: "bob:n1", chainId: 1, domain: "d" });
    assert.notEqual(key1, key2);
  });

  it("uses wildcard for null chainId and domain", () => {
    const key = buildReplayScopeKey({ actor: "a", nonce: "n" });
    assert.ok(key.includes("*"));
  });

  it("throws on missing actor", () => {
    assert.throws(() => buildReplayScopeKey({ actor: "", nonce: "n" }), /actor is required/);
  });

  it("throws on missing nonce", () => {
    assert.throws(() => buildReplayScopeKey({ actor: "a", nonce: "" }), /nonce is required/);
  });
});

describe("validateReplayWindow", () => {
  const validPayload = {
    actor: "0xabc",
    nonce: "unique-1",
    expiry: Math.floor(Date.now() / 1000) + 300, // 5 min from now
    chainId: 1,
    domain: "app",
  };

  it("accepts a valid, fresh request", () => {
    const result = validateReplayWindow(validPayload);
    assert.equal(result.ok, true);
    assert.equal(result.code, "ok");
    assert.ok(result.nonceKey);
  });

  it("rejects missing actor", () => {
    const result = validateReplayWindow({ ...validPayload, actor: "" });
    assert.equal(result.ok, false);
    assert.equal(result.code, "missing_actor");
  });

  it("rejects missing nonce", () => {
    const result = validateReplayWindow({ ...validPayload, nonce: "" });
    assert.equal(result.ok, false);
    assert.equal(result.code, "missing_nonce");
  });

  it("rejects missing expiry", () => {
    const result = validateReplayWindow({ ...validPayload, expiry: undefined });
    assert.equal(result.ok, false);
    assert.equal(result.code, "missing_expiry");
  });

  it("rejects expired request", () => {
    const expired = { ...validPayload, expiry: Math.floor(Date.now() / 1000) - 60 }; // 1 min ago
    const result = validateReplayWindow(expired);
    assert.equal(result.ok, false);
    assert.equal(result.code, "expired");
  });

  it("rejects replayed nonce", () => {
    const seen = new Set();
    const r1 = validateReplayWindow(validPayload, { seenNonceKeys: seen });
    assert.equal(r1.ok, true);
    seen.add(r1.nonceKey);

    const r2 = validateReplayWindow(validPayload, { seenNonceKeys: seen });
    assert.equal(r2.ok, false);
    assert.equal(r2.code, "replayed_nonce");
  });

  it("rejects chain mismatch", () => {
    const result = validateReplayWindow(validPayload, { expectedChainId: 42 });
    assert.equal(result.ok, false);
    assert.equal(result.code, "chain_mismatch");
  });

  it("rejects domain mismatch", () => {
    const result = validateReplayWindow(validPayload, { expectedDomain: "other" });
    assert.equal(result.ok, false);
    assert.equal(result.code, "domain_mismatch");
  });

  it("respects clock skew allowance", () => {
    const justExpired = { ...validPayload, expiry: Math.floor(Date.now() / 1000) - 2 }; // 2 sec ago
    const strict = validateReplayWindow(justExpired, { allowedClockSkewSeconds: 0 });
    assert.equal(strict.ok, false);

    const lenient = validateReplayWindow(justExpired, { allowedClockSkewSeconds: 10 });
    assert.equal(lenient.ok, true);
  });

  it("uses seconds consistently (not milliseconds)", () => {
    // Expiry set 5 minutes from now in SECONDS
    const futureSeconds = Math.floor(Date.now() / 1000) + 300;
    const result = validateReplayWindow(
      { ...validPayload, expiry: futureSeconds },
      { nowSeconds: futureSeconds - 100 }, // 100 seconds before expiry
    );
    assert.equal(result.ok, true);
  });
});

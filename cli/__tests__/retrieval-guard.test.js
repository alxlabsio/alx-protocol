import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createRateLimiter,
  isWriteAuthorized,
  loadRetrievalGuardConfig,
} from "../lib/retrieval-guard.js";

test("rate limiter blocks after max requests in window", () => {
  const limiter = createRateLimiter({ maxRequests: 2, windowMs: 60_000 });
  assert.equal(limiter("client-a"), true);
  assert.equal(limiter("client-a"), true);
  assert.equal(limiter("client-a"), false);
  assert.equal(limiter("client-b"), true);
});

test("write auth accepts bearer and header key", () => {
  const req = {
    headers: {
      authorization: "Bearer team-secret",
    },
  };
  assert.equal(isWriteAuthorized(req, "team-secret"), true);

  const headerReq = {
    headers: {
      "x-alx-api-key": "team-secret",
    },
  };
  assert.equal(isWriteAuthorized(headerReq, "team-secret"), true);
  assert.equal(isWriteAuthorized({ headers: {} }, "team-secret"), false);
  assert.equal(isWriteAuthorized({ headers: {} }, null), true);
});

test("loadRetrievalGuardConfig reads environment", () => {
  const cfg = loadRetrievalGuardConfig({
    ALX_RETRIEVAL_API_KEY: "  key  ",
    ALX_RETRIEVAL_RATE_LIMIT: "60",
    ALX_RETRIEVAL_RATE_WINDOW_MS: "5000",
  });
  assert.equal(cfg.apiKey, "key");
  assert.equal(cfg.maxRequests, 60);
  assert.equal(cfg.windowMs, 5000);
});

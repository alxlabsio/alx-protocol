import assert from "node:assert/strict";
import test from "node:test";

import { compareExactResult } from "../../../conformance/lib/exact-result.js";

test("exact result comparison ignores object key insertion order", () => {
  assert.deepEqual(
    compareExactResult({ checked: true, status: "valid" }, { status: "valid", checked: true }),
    { matches: true },
  );
});

test("exact result comparison rejects missing, extra, and changed nested fields", () => {
  const expected = {
    checked: true,
    context: { protocolVersion: "1" },
    issues: [],
  };

  assert.equal(compareExactResult({ checked: true, context: { protocolVersion: "1" } }, expected).matches, false);
  assert.equal(compareExactResult({ ...expected, summary: "valid" }, expected).matches, false);
  assert.equal(
    compareExactResult({ ...expected, context: { protocolVersion: "2" } }, expected).matches,
    false,
  );
});

test("exact result comparison preserves array ordering", () => {
  const first = { issues: [{ code: "ALX_A" }, { code: "ALX_B" }] };
  const second = { issues: [{ code: "ALX_B" }, { code: "ALX_A" }] };
  assert.equal(compareExactResult(first, second).matches, false);
});

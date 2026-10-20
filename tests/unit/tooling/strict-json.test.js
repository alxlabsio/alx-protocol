import assert from "node:assert/strict";
import test from "node:test";

import { decodeStrictJsonBytes, parseStrictJson } from "../../../conformance/lib/strict-json.js";

test("strict JSON accepts decoded values without changing their representation", () => {
  assert.deepEqual(parseStrictJson('{"a":1,"nested":[true,null,{"b":"text"}]}'), {
    a: 1,
    nested: [true, null, { b: "text" }],
  });
});

test("strict JSON rejects duplicate decoded member names at every depth", () => {
  assert.throws(() => parseStrictJson('{"a":1,"a":2}'), /duplicate JSON member/);
  assert.throws(() => parseStrictJson('{"outer":{"a":1,"\\u0061":2}}'), /duplicate JSON member/);
});

test("strict JSON rejects malformed UTF-8 and trailing data", () => {
  assert.throws(() => decodeStrictJsonBytes(Uint8Array.from([0xff])), /invalid UTF-8/);
  assert.throws(() => parseStrictJson('{"a":1} trailing'), SyntaxError);
});

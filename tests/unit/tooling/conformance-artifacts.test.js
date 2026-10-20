import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeLfText,
  sha256Text,
} from "../../../conformance/lib/text-digest.js";

test("canonical artifact checksums are stable across LF and CRLF checkouts", () => {
  const lf = "first line\nsecond line\n";
  const crlf = "first line\r\nsecond line\r\n";

  assert.equal(normalizeLfText(crlf), lf);
  assert.equal(sha256Text(crlf), sha256Text(lf));
  assert.notEqual(sha256Text(`${lf}changed\n`), sha256Text(lf));
});

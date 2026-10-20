import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_PARENTS,
  sanitizeImportedParentHashes as sanitizeFromHashUtilities,
} from "../../sdk/dist/hash-utils.js";
import {
  createBlock,
  sanitizeImportedParentHashes as sanitizeFromBlock,
} from "../../sdk/dist/block.js";
import {
  sanitizeImportedParentHashes as sanitizeFromRoot,
} from "../../sdk/dist/index.js";

const sanitizeImportedParentHashes = sanitizeFromHashUtilities;

function parentHash(index) {
  return `0x${index.toString(16).padStart(64, "0")}`;
}

test("sanitizer is exported from SDK root, Block, and hash-utility entry points", () => {
  assert.equal(sanitizeFromRoot, sanitizeFromHashUtilities);
  assert.equal(sanitizeFromBlock, sanitizeFromHashUtilities);
});

test("sanitizer treats omitted input as an empty usable parent set", () => {
  assert.deepEqual(sanitizeImportedParentHashes(), {
    ok: true,
    parentHashes: [],
    rejected: [],
    duplicates: [],
    collectionErrors: [],
  });
});

test("sanitizer reports each non-array collection shape without throwing", () => {
  for (const value of [null, "not-an-array", { parent: "hash" }, 12, true]) {
    assert.deepEqual(sanitizeImportedParentHashes(value), {
      ok: false,
      parentHashes: [],
      rejected: [{ index: null, value, reason: "not_array" }],
      duplicates: [],
      collectionErrors: [],
    });
  }
});

test("sanitizer reports exact rejected entries and normalized duplicates", () => {
  const a = parentHash(10);
  const bUpper = parentHash(11).toUpperCase().replace("0X", "0x");
  const input = [
    bUpper,
    "invalid",
    null,
    a,
    `  ${a.toUpperCase()}  `,
  ];

  const result = sanitizeImportedParentHashes(input);

  assert.deepEqual(result, {
    ok: false,
    parentHashes: [a, bUpper.toLowerCase()].sort(),
    rejected: [
      { index: 1, value: "invalid", reason: "invalid_format" },
      { index: 2, value: null, reason: "invalid_type" },
    ],
    duplicates: [{ index: 4, hash: a }],
    collectionErrors: [],
  });
  assert.deepEqual(input, [
    bUpper,
    "invalid",
    null,
    a,
    `  ${a.toUpperCase()}  `,
  ]);
});

test("sanitizer marks duplicate-only input usable after normalization", () => {
  const a = parentHash(1);
  const result = sanitizeImportedParentHashes([a, a.toUpperCase().replace("0X", "0x")]);

  assert.equal(result.ok, true);
  assert.deepEqual(result.parentHashes, [a]);
  assert.deepEqual(result.duplicates, [{ index: 1, hash: a }]);
  assert.deepEqual(result.rejected, []);
  assert.deepEqual(result.collectionErrors, []);
});

test("sanitizer accepts the exact distinct-parent boundary", () => {
  const input = Array.from({ length: MAX_PARENTS }, (_, index) => parentHash(index));
  const expected = [...input].sort();
  const result = sanitizeImportedParentHashes([...input].reverse());

  assert.equal(result.ok, true);
  assert.equal(result.parentHashes.length, MAX_PARENTS);
  assert.deepEqual(result.parentHashes, expected);
  assert.deepEqual(result.collectionErrors, []);
});

test("sanitizer reports normalized collection overflow", () => {
  const input = Array.from({ length: MAX_PARENTS + 1 }, (_, index) => parentHash(index));
  const result = sanitizeImportedParentHashes(input);

  assert.equal(result.ok, false);
  assert.equal(result.parentHashes.length, MAX_PARENTS + 1);
  assert.deepEqual(result.collectionErrors, [{
    reason: "too_many_parents",
    count: MAX_PARENTS + 1,
    maximum: MAX_PARENTS,
  }]);
  assert.throws(
    () => createBlock({ task: "import-overflow-check" }, result.parentHashes),
    { message: /^\[ALX_TOO_MANY_PARENTS\]/ },
  );
});

test("sanitizer applies the parent limit after deduplication", () => {
  const distinct = Array.from({ length: MAX_PARENTS }, (_, index) => parentHash(index));
  const result = sanitizeImportedParentHashes([...distinct, distinct[0]]);

  assert.equal(result.ok, true);
  assert.equal(result.parentHashes.length, MAX_PARENTS);
  assert.deepEqual(result.duplicates, [{ index: MAX_PARENTS, hash: distinct[0] }]);
  assert.deepEqual(result.collectionErrors, []);
});

test("strict Block creation remains fail closed when sanitizer is not requested", () => {
  const valid = parentHash(1);

  assert.throws(
    () => createBlock({ task: "strict-import-check" }, [valid, "invalid"]),
    { message: /^\[ALX_INVALID_HASH\]/ },
  );
});

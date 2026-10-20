import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { validateGraph } from "../../../sdk/dist/block-lineage.js";

const suiteNames = [
  "graph-validation-outcomes",
  "lineage-boundaries",
  "semantic-validity",
  "semantic-integrity",
];

function loadSuite(name) {
  return JSON.parse(
    readFileSync(new URL(`../../../test-vectors/graphs/${name}.json`, import.meta.url), "utf8"),
  );
}

test("canonical TypeScript Graph verification matches every validateGraph vector exactly", async (context) => {
  const vectors = suiteNames.flatMap((name) => loadSuite(name).vectors)
    .filter((vector) => vector.operation === "validateGraph");

  assert.equal(vectors.length, 24);
  for (const vector of vectors) {
    await context.test(vector.id, () => {
      const execute = () => validateGraph(
        vector.input.seed,
        vector.input.source,
        vector.input.context,
      );
      if (vector.expected.errorCode) {
        assert.throws(execute, new RegExp(`\\[${vector.expected.errorCode}\\]`));
      } else {
        assert.deepEqual(execute(), vector.expected);
      }
    });
  }
});

test("finite Block source order does not affect exact Graph output", () => {
  const vector = loadSuite("graph-validation-outcomes").vectors.find(({ id }) => id === "GVO3");
  const reversedSource = {
    ...vector.input.source,
    blocks: [...vector.input.source.blocks].reverse(),
  };

  assert.deepEqual(
    validateGraph(vector.input.seed, reversedSource, vector.input.context),
    vector.expected,
  );
});

test("malformed canonical request boundaries fail before returning a checked result", () => {
  const vector = loadSuite("graph-validation-outcomes").vectors.find(({ id }) => id === "GVO1");

  assert.throws(
    () => validateGraph(undefined, vector.input.source, vector.input.context),
    /\[ALX_CONTEXT_ROOT_MISMATCH\]/,
  );
  assert.throws(
    () => validateGraph(vector.input.seed, { kind: "finite" }, vector.input.context),
    /\[ALX_INVALID_GRAPH\]/,
  );
});

test("verification-context extension length follows JSON Schema Unicode code-point semantics", () => {
  const vector = loadSuite("graph-validation-outcomes").vectors.find(({ id }) => id === "GVO1");
  const contextAtLimit = {
    ...vector.input.context,
    extensions: ["😀".repeat(128)],
  };

  const result = validateGraph(vector.input.seed, vector.input.source, contextAtLimit);
  assert.deepEqual(result.context, contextAtLimit);
  assert.throws(
    () => validateGraph(
      vector.input.seed,
      vector.input.source,
      { ...vector.input.context, extensions: ["😀".repeat(129)] },
    ),
    /\[ALX_INVALID_GRAPH\]/,
  );
});

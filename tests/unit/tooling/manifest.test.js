import assert from "node:assert/strict";
import test from "node:test";

import { loadCoreManifest } from "../../../conformance/lib/manifest.js";

test("canonical manifest discovers and validates every required suite", () => {
  const { manifest, suites, suiteIds, vectorIds } = loadCoreManifest();
  const requiredIds = manifest.core.suites
    .filter((suite) => suite.required)
    .map((suite) => suite.id);

  assert.deepEqual(suites.map(({ descriptor }) => descriptor.id), requiredIds);
  assert.equal(suiteIds.size, suites.length);
  assert.equal(
    vectorIds.size,
    suites.reduce((total, { descriptor }) => total + descriptor.vectorCount, 0),
  );
  for (const { descriptor, document } of suites) {
    assert.equal(document.vectors.length, descriptor.vectorCount);
    assert.equal(document.$schema, descriptor.schema);
  }
});

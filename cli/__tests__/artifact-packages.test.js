import { test } from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { validateArtifactPackage } from "../lib/artifact-packages.js";
import { REPO_ROOT } from "../lib/repo-root.js";

test("security-review-decision package validates", async () => {
  const result = await validateArtifactPackage(resolve(REPO_ROOT, "artifact-packages/security-review-decision"));
  assert.equal(result.ok, true);
  assert.equal(result.complete, true);
  assert.equal(result.cidVerified, true);
});

test("tampered package fails validation", async () => {
  const result = await validateArtifactPackage(resolve(REPO_ROOT, "artifact-packages/tampered-package-detection/tampered"));
  assert.equal(result.ok, false);
  assert.ok(result.issues.includes("primary_block_invalid"));
  assert.ok(result.issues.includes("receipt_ok_does_not_match_validation_result"));
});

test("open-world package validates with incomplete graph", async () => {
  const result = await validateArtifactPackage(resolve(REPO_ROOT, "artifact-packages/open-world-private-boundary"));
  assert.equal(result.ok, true);
  assert.equal(result.complete, false);
  assert.ok(result.externalParents.length > 0);
});

test("attributed-research-output package validates with output.json primary block", async () => {
  const result = await validateArtifactPackage(resolve(REPO_ROOT, "artifact-packages/attributed-research-output"));
  assert.equal(result.ok, true);
  assert.equal(result.complete, true);
  assert.equal(result.blockCount, 6);
});

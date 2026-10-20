import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const repositoryRoot = resolve(import.meta.dirname, "../../..");

function referencedLocalFiles(source) {
  return [...source.matchAll(
    /(?:^|[^A-Za-z0-9_-])((?:scripts|conformance|sdk|cli|tests|reference-implementations)\/[A-Za-z0-9_./-]+\.(?:cjs|js|mjs|py))/gmu,
  )].map((match) => match[1]);
}

test("package and workflow local script targets exist", () => {
  const packageSource = readFileSync(resolve(repositoryRoot, "package.json"), "utf8");
  const packageDocument = JSON.parse(packageSource);
  const workflowDirectory = resolve(repositoryRoot, ".github/workflows");
  const workflowSources = readdirSync(workflowDirectory)
    .filter((name) => /\.ya?ml$/u.test(name))
    .map((name) => readFileSync(resolve(workflowDirectory, name), "utf8"));

  const references = new Set([
    packageDocument.bin?.alx?.replace(/^\.\//u, ""),
    ...referencedLocalFiles(packageSource),
    ...workflowSources.flatMap(referencedLocalFiles),
  ].filter(Boolean));
  const missing = [...references]
    .filter((relativePath) => !existsSync(resolve(repositoryRoot, relativePath)))
    .sort();

  assert.deepEqual(missing, [], `Missing local entry points: ${missing.join(", ")}`);
});

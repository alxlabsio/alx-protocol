#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const MALFORMED_OPTIONAL_MARKERS = [
  /\b[A-Za-z_][A-Za-z0-9_]*-(?=[:;)])/g,
  /\b(?:string|number|boolean|unknown|object|function|Set|Map|Array|Record)-(?=`)/g,
];

function listPublicMarkdownFiles() {
  const output = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "--", "*.md"],
    { cwd: REPO_ROOT, encoding: "utf8" },
  );
  return output
    .split(/\r?\n/)
    .filter(Boolean)
    .sort()
    .map((path) => ({ path, absolutePath: resolve(REPO_ROOT, path) }));
}

export function findMalformedOptionalMarkers(source) {
  const findings = [];
  for (const [index, line] of source.split(/\r?\n/).entries()) {
    for (const pattern of MALFORMED_OPTIONAL_MARKERS) {
      for (const match of line.matchAll(pattern)) {
        findings.push({ line: index + 1, marker: match[0] });
      }
    }
  }
  return findings;
}

const errors = [];
const scannerCases = [
  { source: "opts-:", expected: 1 },
  { source: "verifyFn-)", expected: 1 },
  { source: "number-`", expected: 1 },
  { source: "opts?: number", expected: 0 },
  { source: "non-`protocolError`", expected: 0 },
  { source: "EIP-712", expected: 0 },
];
for (const scannerCase of scannerCases) {
  const actual = findMalformedOptionalMarkers(scannerCase.source).length;
  if (actual !== scannerCase.expected) {
    errors.push(
      "verifier self-test failed for " + JSON.stringify(scannerCase.source)
        + ": expected " + scannerCase.expected + ", received " + actual,
    );
  }
}

for (const file of listPublicMarkdownFiles()) {
  for (const finding of findMalformedOptionalMarkers(readFileSync(file.absolutePath, "utf8"))) {
    errors.push(file.path + ":" + finding.line + ": malformed optional marker " + finding.marker);
  }
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log("Documentation API signature verification passed.");

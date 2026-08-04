#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url));
const RANDOM_CASES = 5_000;
const MAX_BUFFER = 32 * 1024 * 1024;

const rustBase = resolve(
  REPO_ROOT,
  "reference-implementations/rust/target/release/conformance_adapter",
);
const rustPath = process.platform === "win32" ? `${rustBase}.exe` : rustBase;

const implementations = [
  {
    name: "typescript",
    command: "node",
    args: ["sdk/conformance-adapter.js"],
  },
  {
    name: "python",
    command: "python",
    args: ["reference-implementations/python/conformance_adapter.py"],
  },
  {
    name: "rust",
    command: rustPath,
    args: [],
  },
];

if (!existsSync(rustPath)) {
  throw new Error(
    "Rust release conformance adapter is missing. Run cargo build --release --bin conformance_adapter in reference-implementations/rust.",
  );
}

function callCanonicalizeBatch(implementation, inputs) {
  const payload =
    inputs
      .map((input) => JSON.stringify({ operation: "canonicalize", input }))
      .join("\n") + "\n";
  const result = spawnSync(implementation.command, implementation.args, {
    cwd: REPO_ROOT,
    input: payload,
    encoding: "utf8",
    maxBuffer: MAX_BUFFER,
  });

  if (result.status !== 0) {
    throw new Error(
      `${implementation.name} exited ${result.status}: ${result.stderr || result.stdout}`,
    );
  }

  const responses = result.stdout.trim().split(/\r?\n/).map(JSON.parse);
  if (responses.length !== inputs.length) {
    throw new Error(
      `${implementation.name} returned ${responses.length}/${inputs.length} responses`,
    );
  }
  return responses;
}

const vectorSuite = JSON.parse(
  readFileSync(
    resolve(REPO_ROOT, "protocol/test-vectors/canonicalization.json"),
    "utf8",
  ),
);
const vectorInputs = vectorSuite.vectors.map((vector) => vector.input);

for (const implementation of implementations) {
  const responses = callCanonicalizeBatch(implementation, vectorInputs);
  responses.forEach((response, index) => {
    const vector = vectorSuite.vectors[index];
    if (response.error || response.output !== vector.expected) {
      throw new Error(
        `${implementation.name} ${vector.id}: ${JSON.stringify(response)} != ${JSON.stringify(vector.expected)}`,
      );
    }
  });
}

let state = 0x5eed1234;
function nextUint32() {
  state ^= state << 13;
  state ^= state >>> 17;
  state ^= state << 5;
  return state >>> 0;
}

const view = new DataView(new ArrayBuffer(8));
const randomInputs = [];
while (randomInputs.length < RANDOM_CASES) {
  view.setUint32(0, nextUint32());
  view.setUint32(4, nextUint32());
  const value = view.getFloat64(0);
  if (!Number.isFinite(value)) continue;
  if (Number.isInteger(value) && !Number.isSafeInteger(value)) continue;
  randomInputs.push(value);
}

const results = new Map(
  implementations.map((implementation) => [
    implementation.name,
    callCanonicalizeBatch(implementation, randomInputs),
  ]),
);

for (let index = 0; index < randomInputs.length; index++) {
  const expected = results.get("typescript")[index];
  if (expected.error) {
    throw new Error(`TypeScript rejected accepted case ${index}: ${expected.error}`);
  }
  for (const name of ["python", "rust"]) {
    const actual = results.get(name)[index];
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(
        `${name} differential case ${index} (${JSON.stringify(randomInputs[index])}): ${JSON.stringify(actual)} != ${JSON.stringify(expected)}`,
      );
    }
  }
}

console.log(
  `Core differential audit passed: ${vectorInputs.length} canonical vectors and ${randomInputs.length} deterministic IEEE 754 cases across TypeScript, Python, and Rust.`,
);

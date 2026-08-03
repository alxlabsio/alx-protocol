#!/usr/bin/env node

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { REPO_ROOT } from "../lib/repo-root.js";

function callAdapter(cmd, args, operation, input) {
  const payload = `${JSON.stringify({ operation, input })}\n`;
  const result = spawnSync(cmd, args, {
    cwd: REPO_ROOT,
    input: payload,
    encoding: "utf-8",
  });
  if (result.status !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} failed: ${result.stderr || result.stdout}`);
  }
  const line = result.stdout.trim().split("\n").filter(Boolean).pop();
  const parsed = JSON.parse(line);
  if (parsed.error) throw new Error(parsed.error);
  return parsed.output ?? parsed;
}

const rustBin = resolve(REPO_ROOT, "reference-implementations/rust/target/release/conformance_adapter");
const rustBinExe = `${rustBin}.exe`;
const rustPath = existsSync(rustBinExe) ? rustBinExe : rustBin;

const impls = [
  { name: "typescript", cmd: "node", args: ["sdk/conformance-adapter.js"] },
  { name: "python", cmd: "python", args: ["reference-implementations/python/conformance_adapter.py"] },
];
if (existsSync(rustPath)) {
  impls.push({ name: "rust", cmd: rustPath, args: [] });
}

const vectors = JSON.parse(readFileSync(resolve(REPO_ROOT, "protocol/test-vectors/block-identity.json"), "utf-8"));
const cases = vectors.vectors.flatMap((vector) => vector.input
  ? [{ id: vector.id, label: "input", input: vector.input, expected: vector.expected }]
  : [
      { id: vector.id, label: "input_a", input: vector.input_a, expected: vector.expected_a },
      { id: vector.id, label: "input_b", input: vector.input_b, expected: vector.expected_b },
    ]);

const available = [];
for (const impl of impls) {
  try {
    callAdapter(impl.cmd, impl.args, "createBlock", cases[0].input);
    available.push(impl);
  } catch (err) {
    console.error(`Skipping ${impl.name}: ${err.message}`);
  }
}

if (available.length < 2) {
  console.error("Need at least two implementations for differential core check.");
  process.exit(1);
}

for (const testCase of cases) {
  for (const impl of available) {
    const block = callAdapter(impl.cmd, impl.args, "createBlock", testCase.input);
    const envelope = callAdapter(impl.cmd, impl.args, "canonicalize", {
      content: testCase.input.content ?? null,
      parentHashes: block.parentHashes,
    });
    const envelopeHex = Buffer.from(envelope, "utf8").toString("hex");
    const actual = {
      blockHash: block.blockHash,
      contentHash: block.contentHash,
      parentHashes: block.parentHashes,
      canonicalEnvelopeHex: envelopeHex,
    };
    for (const [field, expected] of Object.entries(testCase.expected)) {
      if (JSON.stringify(actual[field]) !== JSON.stringify(expected)) {
        console.error(`${testCase.id}.${testCase.label} ${impl.name} ${field}: ${JSON.stringify(actual[field])} != ${JSON.stringify(expected)}`);
        process.exit(1);
      }
    }
    const inputContent = callAdapter(impl.cmd, impl.args, "canonicalize", testCase.input.content);
    const blockContent = callAdapter(impl.cmd, impl.args, "canonicalize", block.content);
    if (blockContent !== inputContent) {
      console.error(`${testCase.id}.${testCase.label} ${impl.name}: content was not preserved`);
      process.exit(1);
    }
  }
}

console.log(`Differential core check passed for ${cases.length} Block inputs across ${available.map((i) => i.name).join(", ")}.`);

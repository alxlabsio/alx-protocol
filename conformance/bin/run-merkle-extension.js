#!/usr/bin/env node

/**
 * ALX Merkle Extension Conformance Runner
 *
 * Tests implementations that claim support for the optional Merkle extension.
 * This suite is intentionally separate from core ALX conformance.
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseCommand, createExternalImpl, createRunner, green, red, bold, dim } from "../lib/impl.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const VECTORS_FILE = resolve(__dirname, "../../protocol/extensions/merkle/test-vectors/merkle.json");
const LIB_DIR = resolve(__dirname, "../../sdk/dist");


async function createSelfTestImpl() {
  const lib = (name) => pathToFileURL(resolve(LIB_DIR, name)).href;
  const { buildMerkleTree, verifyMerkleProof } = await import(lib("merkle.js"));
  return {
    async call(operation, input) {
      switch (operation) {
        case "buildMerkleTree": return buildMerkleTree(input.leaves);
        case "verifyMerkleProof": return verifyMerkleProof(input.root, input.leaf, input.proof);
        default: throw new Error(`Unknown operation: ${operation}`);
      }
    },
    async close() {},
  };
}

async function createImpl(args) {
  const implIdx = args.indexOf("--impl");
  if (implIdx !== -1 && args[implIdx + 1]) return createExternalImpl(args[implIdx + 1]);
  return createSelfTestImpl();
}

async function main() {
  const args = process.argv.slice(2);
  const impl = await createImpl(args);
  const runner = createRunner();
  const data = JSON.parse(readFileSync(VECTORS_FILE, "utf-8"));

  console.log(`\n${bold("ALX Merkle Extension Conformance")} ${dim("optional extension")}\n`);

  for (const v of data.vectors) {
    try {
      if (v.input.leaves) {
        const result = await impl.call("buildMerkleTree", { leaves: v.input.leaves });
        const ok =
          (v.expected.root === undefined || result.root === v.expected.root) &&
          (v.expected.layerCount === undefined || result.layers.length === v.expected.layerCount) &&
          (v.expected.leafCount === undefined || result.layers[0].length === v.expected.leafCount);
        ok ? runner.pass(v.id, v.description) : runner.fail(v.id, v.description, `unexpected tree result: ${JSON.stringify(result)}`);
      } else {
        const result = await impl.call("verifyMerkleProof", v.input);
        result === v.expected.valid ? runner.pass(v.id, v.description) : runner.fail(v.id, v.description, `expected ${v.expected.valid}, got ${result}`);
      }
    } catch (e) {
      runner.fail(v.id, v.description, `ERROR: ${e.message}`);
    }
  }

  await impl.close();
  const { passed, failed, total } = runner.getState();
  console.log(`\n  ${"─".repeat(44)}`);
  console.log(`  ${bold("Total:")} ${passed}/${total} passed` + (failed > 0 ? `, ${red(`${failed} failed`)}` : ""));
  console.log();
  if (failed === 0) console.log(`  ${green("✓")} ${green("MERKLE EXTENSION CONFORMANT")}`);
  else console.log(`  ${red("✗")} ${red("MERKLE EXTENSION NOT CONFORMANT")}`);
  console.log();
  process.exit(failed > 0 ? 1 : 0);
}

await main();

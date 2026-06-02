#!/usr/bin/env node

/**
 * ALX IPFS Artifact Package Extension Conformance Runner
 *
 * Schema-only extension: validates manifest fixtures against the extension schema.
 */

import Ajv2020 from "ajv/dist/2020.js";
import { readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRunner } from "../lib/impl.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXT_ROOT = resolve(__dirname, "../../protocol/extensions/ipfs-artifact-package");
const VECTORS_FILE = join(EXT_ROOT, "test-vectors/manifest-validation.json");

const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;

async function main() {
  const runner = createRunner();

  const ajv = new Ajv2020({ strict: false, allErrors: true });
  for (const schemaName of ["defs.schema.json", "block.schema.json"]) {
    ajv.addSchema(JSON.parse(readFileSync(resolve(__dirname, "../../protocol/schemas", schemaName), "utf-8")));
  }

  const suite = JSON.parse(readFileSync(VECTORS_FILE, "utf-8"));
  const schemaPath = resolve(__dirname, "../../", suite.schema);
  const schema = JSON.parse(readFileSync(schemaPath, "utf-8"));
  ajv.addSchema(schema, schema.$id);
  const validate = ajv.getSchema(schema.$id);

  console.log(`\n${bold("ALX IPFS Artifact Package Extension Conformance")} ${dim("schema-only extension")}\n`);

  for (const vector of suite.vectors) {
    const fixturePath = join(EXT_ROOT, vector.fixture);
    const data = JSON.parse(readFileSync(fixturePath, "utf-8"));
    const ok = validate(data);
    const expectValid = vector.expected?.valid === true;

    if (ok === expectValid) {
      runner.pass(vector.id, vector.description);
    } else if (expectValid) {
      runner.fail(vector.id, vector.description, validate.errors?.[0]?.message ?? "schema rejected valid fixture");
    } else {
      runner.fail(vector.id, vector.description, "schema accepted invalid fixture");
    }
  }

  const { passed, failed, total } = runner.getState();
  console.log(`\n  ${"─".repeat(44)}`);
  console.log(`  ${bold("Total:")} ${passed}/${total} passed` + (failed > 0 ? `, ${red(`${failed} failed`)}` : ""));
  console.log();
  if (failed === 0) console.log(`  ${green("✓")} ${green("IPFS EXTENSION CONFORMANT")}`);
  else console.log(`  ${red("✗")} ${red("IPFS EXTENSION NOT CONFORMANT")}`);
  console.log();
  if (failed > 0) process.exit(1);
}

await main();

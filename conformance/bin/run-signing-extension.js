#!/usr/bin/env node

/**
 * ALX Signing Extension Conformance Runner
 *
 * Tests implementations that claim support for the optional signing extension.
 * This suite is intentionally separate from core ALX conformance.
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCommand, createExternalImpl, createRunner, green, red, bold, dim } from "../lib/impl.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const VECTOR_FILES = [
  resolve(__dirname, "../../protocol/extensions/signing/test-vectors/signed-blocks.json"),
  resolve(__dirname, "../../protocol/extensions/signing/test-vectors/ed25519-attestations.json"),
  resolve(__dirname, "../../protocol/extensions/signing/test-vectors/p256-attestations.json"),
];


async function createSelfTestImpl() {
  const { validateSignedBlock } = await import("@alx-protocol/sdk/block");
  const { Ed25519Verifier } = await import("@alx-protocol/sdk/ed25519");
  const { P256Verifier } = await import("@alx-protocol/sdk/p256");
  return {
    async call(operation, input) {
      let verifier;
      if (operation === "validateSignedBlockFixture") {
        verifier = {
          algorithm: "fixture",
          async verify(data, signature, expectedSigner) {
            const hex = Buffer.from(data).toString("hex");
            const signer = signature.split(":", 1)[0] ?? "";
            const ok = signature === `${signer}:${hex}` && (!expectedSigner || expectedSigner === signer);
            return { ok, signer };
          },
        };
      } else if (operation === "validatePortableSignedBlock") {
        const algorithm = input.attestation?.algorithm;
        verifier = algorithm === "ed25519"
          ? new Ed25519Verifier()
          : algorithm === "p256"
            ? new P256Verifier()
            : null;
        if (!verifier) throw new Error(`Unsupported portable signing algorithm: ${algorithm}`);
      } else {
        throw new Error(`Unknown operation: ${operation}`);
      }
      return validateSignedBlock(input, verifier);
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

  console.log(`\n${bold("ALX Signing Extension Conformance")} ${dim("optional extension")}\n`);

  for (const vectorsFile of VECTOR_FILES) {
    const data = JSON.parse(readFileSync(vectorsFile, "utf-8"));
    for (const v of data.vectors) {
      try {
        const result = await impl.call(v.operation ?? "validateSignedBlockFixture", v.input);
        const checks = [];
        if (result.ok !== v.expected.ok) checks.push(`ok: ${result.ok} vs ${v.expected.ok}`);
        if (v.expected.attestationCount != null && (result.attestations?.length ?? 0) !== v.expected.attestationCount) checks.push(`attestationCount: ${result.attestations?.length ?? 0} vs ${v.expected.attestationCount}`);
        if (v.expected.reason && result.attestation?.reason !== v.expected.reason) checks.push(`reason: ${result.attestation?.reason} vs ${v.expected.reason}`);
        if (v.expected.algorithm && result.attestation?.algorithm !== v.expected.algorithm) checks.push(`algorithm: ${result.attestation?.algorithm} vs ${v.expected.algorithm}`);
        checks.length === 0 ? runner.pass(v.id, v.description) : runner.fail(v.id, v.description, checks.join("; "));
      } catch (e) {
        runner.fail(v.id, v.description, `ERROR: ${e.message}`);
      }
    }
  }

  await impl.close();

  const { passed, failed, total } = runner.getState();
  console.log(`\n  ${"─".repeat(44)}`);
  console.log(`  ${bold("Total:")} ${passed}/${total} passed` + (failed > 0 ? `, ${red(`${failed} failed`)}` : ""));
  console.log();
  if (failed === 0) console.log(`  ${green("✓")} ${green("SIGNING EXTENSION CONFORMANT")}`);
  else console.log(`  ${red("✗")} ${red("SIGNING EXTENSION NOT CONFORMANT")}`);
  console.log();
  process.exit(failed > 0 ? 1 : 0);
}

await main();

#!/usr/bin/env node

/**
 * ALX Protocol Conformance Adapter — TypeScript Reference Implementation
 *
 * This adapter exposes the TypeScript reference implementation via the
 * standard conformance interface (stdin/stdout JSON protocol).
 *
 * Usage:
 *   echo '{"operation":"canonicalize","input":{"b":2,"a":1}}' | node conformance-adapter.js
 *
 * The adapter reads one JSON operation per line from stdin, executes it,
 * and writes one JSON result per line to stdout.
 *
 * When stdin closes, the adapter exits.
 */

import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createInterface } from "node:readline";

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(__dirname, "dist");

function lib(name) { return pathToFileURL(resolve(distDir, name)).href; }

const { canonicalizeProtocolJson } = await import(lib("canonicalization.js"));
const { deriveBlockHash, deriveContentHash, createBlock, validateBlock, validateSignedBlock, normalizeHashes } = await import(lib("block.js"));
const { traceAttribution, verifyTrace } = await import(lib("block-trace.js"));
const { validateGraph, validateIncrementalBlock, verifyGraph } = await import(lib("block-lineage.js"));
const { buildMerkleTree, verifyMerkleProof } = await import(lib("merkle.js"));
const { Ed25519Verifier } = await import(lib("ed25519.js"));
const { P256Verifier } = await import(lib("p256.js"));

async function handle(op) {
  switch (op.operation) {
    case "canonicalize":
      return { output: canonicalizeProtocolJson(op.input) };

    case "canonicalizeGeneratedDepth": {
      let value = op.input.leaf;
      for (let i = 0; i < op.input.generatedDepth; i++) value = { nested: value };
      return { output: canonicalizeProtocolJson(value) };
    }

    case "deriveBlockHash":
      return { output: deriveBlockHash(op.input.content, op.input.parentHashes ?? []) };

    case "deriveContentHash":
      return { output: deriveContentHash(op.input.content) };

    case "createBlock": {
      const block = createBlock(op.input.content, op.input.parentHashes ?? []);
      return { output: block };
    }

    case "validateBlock": {
      const result = validateBlock(op.input);
      return { output: result };
    }

    case "normalizeHashes":
      return { output: normalizeHashes(op.input) };

    case "validateSignedBlockFixture": {
      const verifier = {
        algorithm: "fixture",
        async verify(data, signature, expectedSigner) {
          const hex = Buffer.from(data).toString("hex");
          const signer = signature.split(":", 1)[0] ?? "";
          const ok = signature === `${signer}:${hex}` && (!expectedSigner || expectedSigner === signer);
          return { ok, signer };
        },
      };
      return { output: await validateSignedBlock(op.input, verifier) };
    }

    case "validatePortableSignedBlock": {
      const algorithm = op.input.attestation?.algorithm;
      const verifier = algorithm === "ed25519"
        ? new Ed25519Verifier()
        : algorithm === "p256"
          ? new P256Verifier()
          : null;
      if (!verifier) return { error: `Unsupported portable signing algorithm: ${algorithm}` };
      return { output: await validateSignedBlock(op.input, verifier) };
    }

    case "traceAttribution": {
      const graph = new Map(Object.entries(op.input.graph));
      const trace = traceAttribution(op.input.rootHash, graph, op.input.context);
      return { output: trace };
    }

    case "validateGraph": {
      const graph = new Map(Object.entries(op.input.graph));
      return { output: validateGraph(graph, op.input.context) };
    }

    case "verifyTrace": {
      const graph = new Map(Object.entries(op.input.graph));
      return { output: verifyTrace(op.input.trace, graph, op.input.context) };
    }

    case "verifyGraph":
      return { output: verifyGraph(op.input.blocks, deriveBlockHash) };

    case "validateIncrementalBlock": {
      const graph = new Map(Object.entries(op.input.existingGraph));
      return { output: validateIncrementalBlock(op.input.block, graph, op.input.context) };
    }

    case "buildMerkleTree":
      return { output: buildMerkleTree(op.input.leaves) };

    case "verifyMerkleProof":
      return { output: verifyMerkleProof(op.input.root, op.input.leaf, op.input.proof) };

    default:
      return { error: `Unknown operation: ${op.operation}` };
  }
}

// Read line-by-line from stdin
const rl = createInterface({ input: process.stdin, terminal: false });

rl.on("line", async (line) => {
  try {
    const op = JSON.parse(line);
    const result = await handle(op);
    console.log(JSON.stringify(result));
  } catch (e) {
    console.log(JSON.stringify({ error: e.message }));
  }
});

rl.on("close", () => process.exit(0));

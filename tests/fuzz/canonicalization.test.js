/**
 * Property-based fuzz tests for ALX Protocol.
 *
 * Uses fast-check with a fixed default seed. Set ALX_FUZZ_SEED to replay another seed.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve, dirname } from "node:path";
import * as fc from "fast-check";

const __dirname = dirname(fileURLToPath(import.meta.url));
function dist(name) { return pathToFileURL(resolve(__dirname, "../../sdk/dist", name)).href; }

const {
  canonicalizeProtocolJson,
  createBlock,
  validateBlock,
  deriveBlockHash,
  traceAttribution,
  validateGraph,
} = await import(dist("index.js"));
const {
  buildMerkleTree,
  getMerkleProof,
  verifyMerkleProof,
} = await import(dist("merkle.js"));

const configuredSeed = process.env.ALX_FUZZ_SEED;
if (configuredSeed !== undefined && !/^-?[0-9]+$/u.test(configuredSeed)) {
  throw new Error(`ALX_FUZZ_SEED must be an integer, got ${JSON.stringify(configuredSeed)}`);
}
const FUZZ_SEED = configuredSeed === undefined ? 20_260_820 : Number(configuredSeed);
if (!Number.isSafeInteger(FUZZ_SEED) || FUZZ_SEED < -2_147_483_648 || FUZZ_SEED > 2_147_483_647) {
  throw new Error(`ALX_FUZZ_SEED is outside the signed 32-bit range: ${configuredSeed}`);
}
const fuzzOptions = (numRuns) => ({ numRuns, seed: FUZZ_SEED, verbose: true });

// ── Generators ──

function jsonSafeValue() {
  return fc.letrec((tie) => ({
    value: fc.oneof(
      { depthIdentifier: "json", maxDepth: 5 },
      fc.constant(null),
      fc.boolean(),
      fc.integer({ min: -1000000, max: 1000000 }),
      fc.double({ min: -1e6, max: 1e6, noNaN: true, noDefaultInfinity: true }),
      fc.string({ maxLength: 100 }),
      fc.array(tie("value"), { maxLength: 5 }),
      fc.dictionary(fc.string({ maxLength: 10 }), tie("value"), { maxKeys: 5 }),
    ),
  })).value;
}

function validHash() {
  // Generate a valid 0x-prefixed 64-char lowercase hex hash
  return fc.tuple(
    ...Array.from({ length: 32 }, () => fc.integer({ min: 0, max: 255 }))
  ).map(bytes => "0x" + bytes.map(b => b.toString(16).padStart(2, "0")).join(""));
}

// ── Properties ──

  describe("Property: canonicalization idempotence", () => {
    it("canonicalize(JSON.parse(canonicalize(x))) === canonicalize(x) for safe JSON values", () => {
      fc.assert(
        fc.property(jsonSafeValue(), (value) => {
          const canonical = canonicalizeProtocolJson(value);
          const reparsed = JSON.parse(canonical);
          const recanonical = canonicalizeProtocolJson(reparsed);
          assert.equal(canonical, recanonical);
        }),
        fuzzOptions(1000),
      );
    });
  });

  describe("Property: block round-trip", () => {
    it("validateBlock(createBlock(content, parents)).ok === true for any safe content", () => {
      fc.assert(
        fc.property(jsonSafeValue(), (content) => {
          const block = createBlock(content);
          const result = validateBlock(block);
          assert.ok(result.ok);
        }),
        fuzzOptions(1000),
      );
    });
  });

  describe("Property: hash determinism", () => {
    it("deriveBlockHash(x) === deriveBlockHash(x) for any input", () => {
      fc.assert(
        fc.property(jsonSafeValue(), (content) => {
          const h1 = deriveBlockHash(content);
          const h2 = deriveBlockHash(content);
          assert.equal(h1, h2);
        }),
        fuzzOptions(1000),
      );
    });
  });

  describe("Property: parent order independence", () => {
    it("createBlock(x, [a,b]).blockHash === createBlock(x, [b,a]).blockHash", () => {
      fc.assert(
        fc.property(jsonSafeValue(), validHash(), validHash(), (content, p1, p2) => {
          const block1 = createBlock(content, [p1, p2]);
          const block2 = createBlock(content, [p2, p1]);
          assert.equal(block1.blockHash, block2.blockHash);
        }),
        fuzzOptions(1000),
      );
    });
  });

  describe("Property: merkle proof round-trip", () => {
    it("verifyMerkleProof(root, leaf, proof) === true for generated proofs", () => {
      fc.assert(
        fc.property(
          fc.array(validHash(), { minLength: 1, maxLength: 20 }).filter(arr => new Set(arr).size === arr.length),
          (leaves) => {
            const tree = buildMerkleTree(leaves);
            for (const leaf of leaves) {
              const proof = getMerkleProof(leaves, leaf);
              if (proof) {
                assert.ok(verifyMerkleProof(tree.root, proof.leaf, proof.proof));
              }
            }
          },
        ),
        fuzzOptions(200),
      );
    });
  });

  describe("Property: generated DAGs validate and trace path counts exactly", () => {
    it("matches independently computed path counts for acyclic layered graphs", () => {
      fc.assert(
        fc.property(fc.integer({ min: 2, max: 8 }), (nodeCount) => {
          const hashes = Array.from({ length: nodeCount }, (_, i) => "0x" + i.toString(16).padStart(64, "0"));
          const graph = new Map();
          graph.set(hashes[0], []);
          for (let i = 1; i < nodeCount; i++) {
            const parents = hashes.slice(0, i).filter((_, index) => index % 2 === i % 2 || index === i - 1);
            graph.set(hashes[i], [...new Set(parents)]);
          }

          assert.equal(validateGraph(graph).ok, true);
          const root = hashes[nodeCount - 1];
          const trace = traceAttribution(root, graph);

          const expected = new Map([[root, 1]]);
          for (let i = nodeCount - 1; i >= 0; i--) {
            const hash = hashes[i];
            const count = expected.get(hash) ?? 0;
            for (const parent of graph.get(hash) ?? []) expected.set(parent, (expected.get(parent) ?? 0) + count);
          }
          for (const node of trace.nodes) assert.equal(node.pathCount, String(expected.get(node.hash)));
        }),
        fuzzOptions(200),
      );
    });
  });

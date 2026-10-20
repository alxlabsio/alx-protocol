import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";

const here = dirname(fileURLToPath(import.meta.url));
const cli = resolve(here, "../../../cli/bin/alx.js");

function run(cwd, args) {
  return spawnSync(process.execPath, [cli, ...args], { cwd, encoding: "utf-8" });
}

function runJson(cwd, args) {
  const result = run(cwd, args);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

describe("Graph navigation CLI", () => {
  let cwd;
  let root;
  let left;
  let right;
  let merge;

  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), "alx-graph-cli-"));
    writeFileSync(join(cwd, "root.json"), '{"step":"root"}');
    writeFileSync(join(cwd, "left.json"), '{"step":"left"}');
    writeFileSync(join(cwd, "right.json"), '{"step":"right"}');
    writeFileSync(join(cwd, "merge.json"), '{"step":"merge"}');

    root = runJson(cwd, ["block", "create", "root.json", "--json"]);
    left = runJson(cwd, [
      "block", "create", "left.json", "--parent", root.blockHash, "--json",
    ]);
    right = runJson(cwd, [
      "block", "create", "right.json", "--parent", root.blockHash, "--json",
    ]);
    merge = runJson(cwd, [
      "block", "create", "merge.json",
      "--parent", left.blockHash,
      "--parent", right.blockHash,
      "--json",
    ]);
  });

  afterEach(() => rmSync(cwd, { recursive: true, force: true }));

  it("queries direct parents and source-relative children from the local index", () => {
    const parents = runJson(cwd, ["graph", "parents", merge.blockHash, "--json"]);
    assert.equal(parents.relationship, "parents");
    assert.equal(parents.completeness, "complete");
    assert.deepEqual(
      parents.blocks.map((block) => block.blockHash),
      [left.blockHash, right.blockHash].sort(),
    );
    assert.ok(parents.blocks.every((block) => block.depth === 1 && block.available));

    const children = runJson(cwd, [
      "graph", "children", root.blockHash.slice(0, 16), "--json",
    ]);
    assert.equal(children.completeness, "source-relative");
    assert.deepEqual(
      children.blocks.map((block) => block.blockHash),
      [left.blockHash, right.blockHash].sort(),
    );
  });

  it("traverses ancestors and descendants with shortest depths", () => {
    const ancestors = runJson(cwd, ["graph", "ancestors", "@last", "--json"]);
    assert.deepEqual(
      ancestors.blocks.map(({ blockHash, depth }) => ({ blockHash, depth })),
      [
        { blockHash: left.blockHash, depth: 1 },
        { blockHash: right.blockHash, depth: 1 },
        { blockHash: root.blockHash, depth: 2 },
      ].sort((a, b) => a.depth - b.depth || a.blockHash.localeCompare(b.blockHash)),
    );
    assert.equal(ancestors.completeness, "complete");

    const descendants = runJson(cwd, ["graph", "descendants", root.blockHash, "--json"]);
    assert.deepEqual(
      descendants.blocks.map(({ blockHash, depth }) => ({ blockHash, depth })),
      [
        { blockHash: left.blockHash, depth: 1 },
        { blockHash: right.blockHash, depth: 1 },
        { blockHash: merge.blockHash, depth: 2 },
      ].sort((a, b) => a.depth - b.depth || a.blockHash.localeCompare(b.blockHash)),
    );
    assert.equal(descendants.completeness, "source-relative");
  });

  it("uses the local index for protocol Trace output", () => {
    const trace = runJson(cwd, ["graph", "trace", "@last", "--json"]);
    assert.equal(trace.root, merge.blockHash);
    assert.equal(trace.complete, true);
    assert.equal(trace.nodes.length, 4);
    assert.equal(trace.edges.length, 4);
    assert.equal(trace.nodes.find((node) => node.hash === root.blockHash).pathCount, "2");
  });

  it("queries Block arrays and adjacency maps supplied through --file", () => {
    const blocksPath = join(cwd, "blocks.json");
    writeFileSync(blocksPath, JSON.stringify([root, left, right, merge]));
    const children = runJson(cwd, [
      "graph", "children", root.blockHash, "--file", blocksPath, "--json",
    ]);
    assert.equal(children.source.type, "graph-file");
    assert.equal(children.source.representation, "block-array");
    assert.ok(children.blocks.every((block) => block.available));

    const adjacencyPath = join(cwd, "adjacency.json");
    writeFileSync(adjacencyPath, JSON.stringify({
      [root.blockHash]: [],
      [left.blockHash]: [root.blockHash],
      [right.blockHash]: [root.blockHash],
      [merge.blockHash]: [left.blockHash, right.blockHash],
    }));
    const descendants = runJson(cwd, [
      "graph", "descendants", root.blockHash,
      "--file", adjacencyPath,
      "--json",
    ]);
    assert.equal(descendants.source.representation, "adjacency-map");
    assert.ok(descendants.blocks.every((block) => !block.available));
  });

  it("rejects malformed or repairable Graph-file input before navigation or Trace", () => {
    const tampered = structuredClone(merge);
    tampered.content = { step: "tampered" };
    writeFileSync(join(cwd, "tampered-blocks.json"), JSON.stringify([root, tampered]));
    const tamperedResult = run(cwd, [
      "graph", "trace", merge.blockHash, "--file", "tampered-blocks.json", "--json",
    ]);
    assert.notEqual(tamperedResult.status, 0);
    assert.match(tamperedResult.stderr, /invalid or non-canonical Block/i);

    writeFileSync(
      join(cwd, "extra-field-blocks.json"),
      JSON.stringify([{ ...root, unexpected: true }]),
    );
    const extraField = run(cwd, [
      "graph", "trace", root.blockHash, "--file", "extra-field-blocks.json", "--json",
    ]);
    assert.notEqual(extraField.status, 0);
    assert.match(extraField.stderr, /invalid or non-canonical Block/i);

    writeFileSync(join(cwd, "duplicate-parents.json"), JSON.stringify({
      [merge.blockHash]: [left.blockHash, left.blockHash],
    }));
    const duplicateParents = run(cwd, [
      "graph", "parents", merge.blockHash, "--file", "duplicate-parents.json", "--json",
    ]);
    assert.notEqual(duplicateParents.status, 0);
    assert.match(duplicateParents.stderr, /duplicate parent hashes/i);

    writeFileSync(
      join(cwd, "duplicate-members.json"),
      `{${JSON.stringify(merge.blockHash)}:[],${JSON.stringify(merge.blockHash)}:[]}`,
    );
    const duplicateMembers = run(cwd, [
      "graph", "parents", merge.blockHash, "--file", "duplicate-members.json", "--json",
    ]);
    assert.notEqual(duplicateMembers.status, 0);
    assert.match(duplicateMembers.stderr, /not valid JSON/i);

    writeFileSync(join(cwd, "invalid-utf8.json"), Buffer.from([0xff]));
    const invalidUtf8 = run(cwd, [
      "graph", "parents", merge.blockHash, "--file", "invalid-utf8.json", "--json",
    ]);
    assert.notEqual(invalidUtf8.status, 0);
    assert.match(invalidUtf8.stderr, /not valid JSON/i);
  });

  it("reports unresolved ancestor boundaries and rejects ambiguous or absent roots", () => {
    const missing = "0x" + "f".repeat(64);
    writeFileSync(join(cwd, "partial.json"), JSON.stringify({
      [merge.blockHash]: [missing],
    }));
    const ancestors = runJson(cwd, [
      "graph", "ancestors", merge.blockHash,
      "--file", "partial.json",
      "--json",
    ]);
    assert.equal(ancestors.completeness, "partial");
    assert.deepEqual(ancestors.blocks, [{
      blockHash: missing,
      depth: 1,
      indexed: false,
      available: false,
    }]);

    const absent = run(cwd, ["graph", "children", "0x" + "e".repeat(64)]);
    assert.notEqual(absent.status, 0);
    assert.match(absent.stderr, /not present or referenced/i);

    const commonPrefix = "0x1234";
    const a = commonPrefix + "a".repeat(60);
    const b = commonPrefix + "b".repeat(60);
    writeFileSync(join(cwd, "ambiguous.json"), JSON.stringify({ [a]: [], [b]: [] }));
    const ambiguous = run(cwd, [
      "graph", "parents", commonPrefix, "--file", "ambiguous.json",
    ]);
    assert.notEqual(ambiguous.status, 0);
    assert.match(ambiguous.stderr, /Ambiguous blockHash prefix/);
  });

  it("terminates traversal for cyclic supplied adjacency data", () => {
    const a = "0x" + "a".repeat(64);
    const b = "0x" + "b".repeat(64);
    writeFileSync(join(cwd, "cycle.json"), JSON.stringify({ [a]: [b], [b]: [a] }));
    const ancestors = runJson(cwd, [
      "graph", "ancestors", a, "--file", "cycle.json", "--json",
    ]);
    assert.deepEqual(ancestors.blocks.map((block) => block.blockHash), [b]);
    const descendants = runJson(cwd, [
      "graph", "descendants", a, "--file", "cycle.json", "--json",
    ]);
    assert.deepEqual(descendants.blocks.map((block) => block.blockHash), [b]);
  });
});

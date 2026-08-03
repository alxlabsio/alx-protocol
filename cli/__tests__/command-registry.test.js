import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import {
  commandDefinitions,
  registeredCommands,
} from "../commands/registry.js";

const here = dirname(fileURLToPath(import.meta.url));
const entryPath = resolve(here, "../bin/alx.js");
const packagePath = resolve(here, "../package.json");

const expectedCommands = [
  "init",
  "block",
  "graph",
  "anchor",
  "server",
  "retrieval",
  "test",
  "test-vectors",
  "conformance",
  "extension-conformance",
  "doctor",
  "version",
];

describe("CLI command registry", () => {
  it("registers each canonical top-level command exactly once", () => {
    assert.deepEqual(registeredCommands, expectedCommands);
    assert.equal(new Set(registeredCommands).size, registeredCommands.length);
    assert.ok(
      commandDefinitions.every(({ handler }) => typeof handler === "function"),
    );
  });

  it("keeps command ownership in cohesive modules", () => {
    assert.deepEqual(
      Object.fromEntries(
        commandDefinitions.map(({ name, source }) => [name, source]),
      ),
      {
        init: "project",
        block: "block",
        graph: "graph",
        anchor: "anchor",
        server: "servers",
        retrieval: "servers",
        test: "proof-test",
        "test-vectors": "conformance",
        conformance: "conformance",
        "extension-conformance": "conformance",
        doctor: "project",
        version: "project",
      },
    );
  });

  it("keeps the executable as a bootstrap instead of a command monolith", () => {
    const entry = readFileSync(entryPath, "utf8");
    assert.match(entry, /dispatchCommand/);
    assert.doesNotMatch(entry, /^(?:async )?function cmd/m);
    assert.doesNotMatch(entry, /switch\s*\(cmd\)/);
    assert.ok(entry.split(/\r?\n/).length <= 35);
  });

  it("publishes the extracted command modules with the CLI package", () => {
    const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
    assert.ok(packageJson.files.includes("commands"));
  });
});

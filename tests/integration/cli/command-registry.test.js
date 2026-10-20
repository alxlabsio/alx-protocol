import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import {
  commandDefinitions,
  registeredCommands,
} from "../../../cli/commands/registry.js";

const here = dirname(fileURLToPath(import.meta.url));
const entryPath = resolve(here, "../../../cli/bin/alx.js");
const packagePath = resolve(here, "../../../cli/package.json");
const readmePath = resolve(here, "../../../cli/README.md");

const expectedCommands = [
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
        block: "block",
        graph: "graph",
        anchor: "anchor",
        server: "servers",
        retrieval: "servers",
        test: "test",
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

  it("documents every registered command in runtime help and the CLI README", () => {
    const help = execFileSync(process.execPath, [entryPath, "--help"], {
      encoding: "utf8",
    }).replace(/\u001b\[[0-9;]*m/g, "");
    const readme = readFileSync(readmePath, "utf8");

    for (const command of registeredCommands) {
      const invocation = "alx " + command;
      assert.match(help, new RegExp(invocation.replace("-", "\\-")));
      assert.match(readme, new RegExp(invocation.replace("-", "\\-")));
    }

    for (const subcommand of [
      "create",
      "show",
      "verify",
      "list",
      "publish",
      "resolve",
    ]) {
      const invocation = "alx block " + subcommand;
      assert.match(help, new RegExp(invocation));
      assert.match(readme, new RegExp(invocation));
    }
  });
});

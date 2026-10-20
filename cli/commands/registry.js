import { die } from "../lib/cli-utils.js";
import { cmdAnchor } from "./anchor.js";
import { cmdBlock } from "./block.js";
import {
  cmdConformance,
  cmdExtensionConformance,
  cmdTestVectors,
} from "./conformance.js";
import { cmdGraph } from "./graph.js";
import { cmdTestRouter } from "./test.js";
import { cmdDoctor, cmdVersion } from "./project.js";
import { cmdRetrieval, cmdServer } from "./servers.js";

export const commandDefinitions = Object.freeze([
  { name: "block", handler: cmdBlock, source: "block" },
  { name: "graph", handler: cmdGraph, source: "graph" },
  { name: "anchor", handler: cmdAnchor, source: "anchor" },
  { name: "server", handler: cmdServer, source: "servers" },
  { name: "retrieval", handler: cmdRetrieval, source: "servers" },
  { name: "test", handler: cmdTestRouter, source: "test" },
  { name: "test-vectors", handler: cmdTestVectors, source: "conformance" },
  { name: "conformance", handler: cmdConformance, source: "conformance" },
  {
    name: "extension-conformance",
    handler: cmdExtensionConformance,
    source: "conformance",
  },
  { name: "doctor", handler: cmdDoctor, source: "project" },
  { name: "version", handler: cmdVersion, source: "project" },
]);

export const registeredCommands = Object.freeze(
  commandDefinitions.map(({ name }) => name),
);

const commandHandlers = new Map(
  commandDefinitions.map(({ name, handler }) => [name, handler]),
);

export async function dispatchCommand(name, args) {
  const handler = commandHandlers.get(name);
  if (!handler) die(`Unknown command: ${name}. Run 'alx --help' for usage.`);
  return handler(args);
}

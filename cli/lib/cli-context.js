import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { readProtocolVersion } from "./protocol-version.js";
import sdk from "./sdk.js";

const cliRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export const REPO_ROOT = resolve(cliRoot, "..");
export const ALX_VERSION = JSON.parse(
  readFileSync(resolve(cliRoot, "package.json"), "utf-8"),
).version;
export const PROTOCOL_VERSION = readProtocolVersion();

export const {
  canonicalizeProtocolJson,
  createBlock,
  validateBlock,
  deriveBlockHash,
  deriveContentHash,
  validateGraph,
  buildGraph,
  traceAttribution,
} = sdk;

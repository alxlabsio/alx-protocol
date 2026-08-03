#!/usr/bin/env node

/** ALX Protocol CLI process bootstrap. */

import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { dispatchCommand } from "../commands/registry.js";
import { usage } from "../commands/help.js";
import { die } from "../lib/cli-utils.js";

const localEnvPath = resolve(process.cwd(), ".env");
if (existsSync(localEnvPath)) {
  try {
    process.loadEnvFile(localEnvPath);
  } catch (err) {
    die(`Unable to load ${localEnvPath}: ${err.message}`);
  }
}

const args = process.argv.slice(2);

if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
  usage();
  process.exit(0);
}

await dispatchCommand(args[0], args.slice(1));

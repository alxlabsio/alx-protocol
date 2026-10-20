#!/usr/bin/env node

import { loadCoreManifest } from "../lib/manifest.js";

try {
  const { suites, vectorIds } = loadCoreManifest();
  process.stdout.write(
    `Suite manifest verification passed (${suites.length} suites, ${vectorIds.size} unique vectors).\n`,
  );
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}

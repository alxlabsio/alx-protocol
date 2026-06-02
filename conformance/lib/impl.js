/**
 * Shared conformance implementation utilities.
 *
 * Used by all conformance/bin/run-*.js runners to avoid duplicating
 * command parsing, external-process communication, and counter state.
 */

import { spawn } from "node:child_process";

export const green = (s) => `\x1b[32m${s}\x1b[0m`;
export const red = (s) => `\x1b[31m${s}\x1b[0m`;
export const bold = (s) => `\x1b[1m${s}\x1b[0m`;
export const dim = (s) => `\x1b[2m${s}\x1b[0m`;

/**
 * Create a test runner that accumulates pass/fail counts locally.
 * Avoids module-level mutable state and CQS-violating side-effectful globals.
 */
export function createRunner() {
  let passed = 0, failed = 0, total = 0;
  const suiteResults = [];
  return {
    pass(id, desc) { passed++; total++; console.log(`  ${green("✓")} ${id}: ${desc}`); },
    fail(id, desc, detail) { failed++; total++; console.log(`  ${red("✗")} ${id}: ${desc}`); if (detail) console.log(`    ${detail}`); },
    pushSuite(result) { suiteResults.push(result); },
    getState() { return { passed, failed, total, suiteResults }; },
  };
}

/**
 * Parse a command string into argv, respecting quoted strings.
 * "node foo.js" → ["node", "foo.js"]
 * '"C:/path with spaces/bin.exe" --flag' → ["C:/path with spaces/bin.exe", "--flag"]
 */
export function parseCommand(cmd) {
  const parts = [];
  let current = "";
  let inQuote = false;
  let quoteChar = "";
  for (const ch of cmd) {
    if (!inQuote && (ch === '"' || ch === "'")) {
      inQuote = true;
      quoteChar = ch;
    } else if (inQuote && ch === quoteChar) {
      inQuote = false;
    } else if (!inQuote && ch === " ") {
      if (current) parts.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current) parts.push(current);
  return parts;
}

/**
 * Create an external implementation interface over a child process.
 *
 * The child process must read JSON operations from stdin (one per line)
 * and write JSON results to stdout (one per line):
 *   stdin:  { "operation": "...", "input": ... }
 *   stdout: { "output": ... }  or  { "error": "..." }
 */
export function createExternalImpl(cmd) {
  const parts = parseCommand(cmd);
  const child = spawn(parts[0], parts.slice(1), { stdio: ["pipe", "pipe", "pipe"] });

  const pending = [];
  let lineBuf = "";
  let stderrBuf = "";

  child.stderr.on("data", (d) => { stderrBuf += d.toString(); });

  child.stdout.on("data", (data) => {
    lineBuf += data.toString();
    const lines = lineBuf.split("\n");
    lineBuf = lines.pop();
    for (const line of lines) {
      if (!line.trim() || pending.length === 0) continue;
      const { resolve, reject } = pending.shift();
      try {
        const result = JSON.parse(line);
        if (result.error) reject(new Error(result.error));
        else resolve(result.output);
      } catch {
        reject(new Error(`Invalid JSON from impl: ${line.slice(0, 100)}`));
      }
    }
  });

  child.on("error", (err) => {
    while (pending.length > 0) pending.shift().reject(new Error(`Process error: ${err.message}`));
  });

  child.on("close", (code) => {
    while (pending.length > 0) {
      pending.shift().reject(new Error(`Process exited with code ${code}. stderr: ${stderrBuf.slice(0, 200)}`));
    }
  });

  return {
    call(operation, input) {
      return new Promise((resolve, reject) => {
        pending.push({ resolve, reject });
        child.stdin.write(JSON.stringify({ operation, input }) + "\n");
      });
    },
    async close() {
      child.stdin.end();
      return new Promise((resolve) => child.on("close", resolve));
    },
  };
}

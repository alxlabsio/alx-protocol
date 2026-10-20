/**
 * Shared conformance implementation utilities.
 *
 * Used by all conformance/bin/run-*.js runners to avoid duplicating
 * command parsing, external-process communication, and counter state.
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

export const green = (s) => `\x1b[32m${s}\x1b[0m`;
export const red = (s) => `\x1b[31m${s}\x1b[0m`;
export const bold = (s) => `\x1b[1m${s}\x1b[0m`;
export const dim = (s) => `\x1b[2m${s}\x1b[0m`;

/**
 * Create a test runner that accumulates pass/fail counts locally.
 * Avoids module-level mutable state and CQS-violating side-effectful globals.
 */
export function createRunner() {
  let passed = 0, failed = 0, skipped = 0, total = 0;
  const suiteResults = [];
  return {
    pass(id, desc) { passed++; total++; console.log(`  ${green("✓")} ${id}: ${desc}`); },
    fail(id, desc, detail) { failed++; total++; console.log(`  ${red("✗")} ${id}: ${desc}`); if (detail) console.log(`    ${detail}`); },
    skip(id, desc) { skipped++; total++; console.log(`  ${dim("-")} ${id}: ${desc}`); },
    pushSuite(result) { suiteResults.push(result); },
    getState() { return { passed, failed, skipped, total, suiteResults }; },
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
export function createExternalImpl(cmd, options = {}) {
  const callTimeoutMs = options.callTimeoutMs ?? 0;
  const maxOutputBytes = options.maxOutputBytes ?? 16 * 1024 * 1024;
  const parts = parseCommand(cmd);
  let executable = parts[0];
  if (
    process.platform === "win32"
    && /[\\/]/.test(executable)
    && !existsSync(executable)
    && existsSync(`${executable}.exe`)
  ) {
    executable = `${executable}.exe`;
  }
  const child = spawn(executable, parts.slice(1), { stdio: ["pipe", "pipe", "pipe"] });

  const pending = [];
  let lineBuf = "";
  let stderrBuf = "";
  let closed = false;
  let resolveClosed;
  const closedPromise = new Promise((resolve) => { resolveClosed = resolve; });

  function rejectAll(error) {
    while (pending.length > 0) {
      const entry = pending.shift();
      clearTimeout(entry.timer);
      entry.reject(error);
    }
  }

  child.stderr.on("data", (d) => {
    if (Buffer.byteLength(stderrBuf) < maxOutputBytes) stderrBuf += d.toString();
  });

  child.stdout.on("data", (data) => {
    lineBuf += data.toString();
    if (Buffer.byteLength(lineBuf) > maxOutputBytes) {
      rejectAll(new Error(`Implementation output exceeded ${maxOutputBytes} bytes without a complete response`));
      child.kill();
      return;
    }
    const lines = lineBuf.split("\n");
    lineBuf = lines.pop();
    for (const line of lines) {
      if (!line.trim() || pending.length === 0) continue;
      const { resolve, reject, timer } = pending.shift();
      clearTimeout(timer);
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
    rejectAll(new Error(`Process error: ${err.message}`));
  });

  child.on("close", (code) => {
    closed = true;
    rejectAll(new Error(`Process exited with code ${code}. stderr: ${stderrBuf.slice(0, 200)}`));
    resolveClosed(code);
  });

  return {
    call(operation, input) {
      return new Promise((resolve, reject) => {
        if (closed || child.stdin.destroyed) {
          reject(new Error("Implementation process is not running"));
          return;
        }
        const entry = { resolve, reject, timer: undefined };
        if (callTimeoutMs > 0) {
          entry.timer = setTimeout(() => {
            rejectAll(new Error(`Implementation call timed out after ${callTimeoutMs}ms (${operation})`));
            child.kill();
          }, callTimeoutMs);
        }
        pending.push(entry);
        child.stdin.write(JSON.stringify({ operation, input }) + "\n", (error) => {
          if (error) {
            const index = pending.indexOf(entry);
            if (index !== -1) pending.splice(index, 1);
            clearTimeout(entry.timer);
            reject(new Error(`Unable to write to implementation process: ${error.message}`));
          }
        });
      });
    },
    async close() {
      if (!closed && !child.stdin.destroyed) child.stdin.end();
      return closedPromise;
    },
  };
}

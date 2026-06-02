/**
 * CLI argument parsing for block create/link (content sources and positionals).
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const HASH_RE = /^0x[a-f0-9]{64}$/;

const FLAGS_WITH_VALUE = new Set([
  "--content",
  "--content-file",
  "--parents",
  "--parent",
  "--out",
  "--append-graph",
]);

export class CliInputError extends Error {
  constructor(message) {
    super(message);
    this.name = "CliInputError";
  }
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isSealedBlockShape(value) {
  if (!value || typeof value !== "object") return false;
  const block = /** @type {Record<string, unknown>} */ (value);
  return (
    typeof block.blockHash === "string" &&
    HASH_RE.test(String(block.blockHash).toLowerCase()) &&
    block.content !== undefined &&
    Array.isArray(block.parentHashes)
  );
}

/**
 * @param {string[]} argv
 * @returns {string[]}
 */
export function getPositionals(argv) {
  const positionals = [];
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token.startsWith("--")) {
      if (FLAGS_WITH_VALUE.has(token) && argv[i + 1] != null) i += 1;
      continue;
    }
    positionals.push(token);
  }
  return positionals;
}

/**
 * @param {string} [cwd]
 */
export function readStdinIfAvailable(cwd = process.cwd()) {
  void cwd;
  if (process.stdin.isTTY) return null;
  try {
    const raw = readFileSync(0, "utf-8").trim();
    return raw.length > 0 ? raw : null;
  } catch {
    return null;
  }
}

/**
 * @param {string} raw
 */
function stripUtf8Bom(raw) {
  return raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
}

/**
 * @param {string} raw
 */
function parseJsonStrict(raw) {
  try {
    return JSON.parse(stripUtf8Bom(raw));
  } catch {
    throw new CliInputError(`Invalid JSON: ${raw.slice(0, 80)}${raw.length > 80 ? "..." : ""}`);
  }
}

/**
 * @param {string} path
 * @param {{ forContent?: boolean }} [opts]
 */
function loadJsonFromPath(path, opts = {}) {
  if (!path || path.startsWith("--")) {
    throw new CliInputError("Expected a file path");
  }
  const abs = resolve(process.cwd(), path);
  if (!existsSync(abs)) {
    throw new CliInputError(`File not found: ${path}`);
  }
  const parsed = parseJsonStrict(readFileSync(abs, "utf-8"));
  if (opts.forContent !== false && isSealedBlockShape(parsed)) {
    throw new CliInputError(
      `${path} looks like a locked Block (blockHash + content + parentHashes). ` +
      "Pass content-only JSON for --content-file, or use this file as --parent / second positional.",
    );
  }
  return { value: parsed, path: abs };
}

/**
 * Resolve Block.content from flags, positionals, or stdin.
 *
 * Precedence: --content > --content-file > positional > stdin (when not a TTY).
 *
 * @param {object} params
 * @param {string[]} params.args
 * @param {string[]} [params.positionalCandidates]
 * @param {boolean} [params.allowStdin]
 * @returns {{ content: object, source: string, path?: string }}
 */
export function resolveContentInput({ args, positionalCandidates = [], allowStdin = true }) {
  const contentIdx = args.indexOf("--content");
  if (contentIdx !== -1) {
    const raw = args[contentIdx + 1];
    if (raw == null || raw === "") {
      throw new CliInputError('--content requires a JSON value or "-" to read stdin');
    }
    if (raw === "-") {
      const stdin = readStdinIfAvailable();
      if (!stdin) throw new CliInputError("No JSON on stdin (pipe content or use --content-file)");
      return { content: parseJsonStrict(stdin), source: "stdin" };
    }
    if (raw.startsWith("{")) {
      return { content: parseJsonStrict(raw), source: "inline" };
    }
    const loaded = loadJsonFromPath(raw, { forContent: true });
    return { content: loaded.value, source: "file", path: loaded.path };
  }

  const fileIdx = args.indexOf("--content-file");
  if (fileIdx !== -1) {
    const path = args[fileIdx + 1];
    if (!path) throw new CliInputError("--content-file requires a path");
    const loaded = loadJsonFromPath(path, { forContent: true });
    return { content: loaded.value, source: "file", path: loaded.path };
  }

  for (const token of positionalCandidates) {
    if (!token) continue;
    if (token.startsWith("{")) {
      return { content: parseJsonStrict(token), source: "positional-inline" };
    }
    const loaded = loadJsonFromPath(token, { forContent: true });
    return { content: loaded.value, source: "positional-file", path: loaded.path };
  }

  if (allowStdin) {
    const stdin = readStdinIfAvailable();
    if (stdin) {
      const parsed = parseJsonStrict(stdin);
      if (isSealedBlockShape(parsed)) {
        throw new CliInputError(
          "Stdin looks like a locked Block. Pipe content-only JSON, or pass the Block file as --parent.",
        );
      }
      return { content: parsed, source: "stdin" };
    }
  }

  throw new CliInputError(
    "Block content required: use --content, --content-file <path>, a positional content path, or pipe JSON to stdin",
  );
}

/**
 * @param {string[]} args
 * @param {string} flagName e.g. "--out"
 */
function flagValue(args, flagName) {
  const idx = args.indexOf(flagName);
  if (idx === -1 || !args[idx + 1]) return null;
  return args[idx + 1];
}

/**
 * @param {string} token
 * @param {string} cwd
 */
function resolveOptionalPath(token, cwd = process.cwd()) {
  if (!token) return null;
  return resolve(cwd, token);
}

/**
 * @param {string[]} args
 * @returns {{
 *   content: object,
 *   contentSource: string,
 *   parents: string[],
 *   outPath: string|null,
 *   graphPath: string|null,
 *   json: boolean,
 *   dryRun: boolean,
 *   positionals: string[],
 * }}
 */
export function parseBlockCreateArgs(args) {
  const positionals = getPositionals(args);
  const hasContentFlag = args.includes("--content") || args.includes("--content-file");

  let contentCandidates = [];
  if (!hasContentFlag) {
    if (positionals.length >= 2) contentCandidates = [positionals[0]];
    else if (positionals.length === 1) contentCandidates = [positionals[0]];
  }

  const { content, source } = resolveContentInput({
    args,
    positionalCandidates: contentCandidates,
  });

  const parentsRaw = flagValue(args, "--parents");
  const parents = parentsRaw
    ? parentsRaw.split(",").map((h) => h.trim()).filter(Boolean)
    : [];

  let outPath = resolveOptionalPath(flagValue(args, "--out"));
  if (!outPath) {
    if (hasContentFlag && positionals.length >= 1) {
      outPath = resolveOptionalPath(positionals[0]);
    } else if (!hasContentFlag && positionals.length >= 2) {
      outPath = resolveOptionalPath(positionals[1]);
    }
  }

  const graphPath = resolveOptionalPath(flagValue(args, "--append-graph"));

  return {
    content,
    contentSource: source,
    parents,
    outPath,
    graphPath,
    json: args.includes("--json"),
    dryRun: args.includes("--dry-run"),
    positionals,
  };
}

/**
 * @param {string[]} args
 * @returns {{
 *   content: object,
 *   contentSource: string,
 *   parentTokens: string[],
 *   outPath: string|null,
 *   graphPath: string|null,
 *   validateParents: boolean,
 *   json: boolean,
 *   dryRun: boolean,
 *   positionals: string[],
 * }}
 */
export function parseBlockLinkArgs(args) {
  const positionals = getPositionals(args);

  const { content, source } = resolveContentInput({
    args,
    positionalCandidates: positionals.length > 0 ? [positionals[0]] : [],
  });

  let parentSpec = flagValue(args, "--parent");
  if (!parentSpec && positionals.length >= 2) {
    parentSpec = positionals[1];
  }
  if (!parentSpec) {
    throw new CliInputError(
      "Parent required: --parent <file>[,<file>...] or second positional (e.g. alx block link content.json parent.block.json)",
    );
  }

  const parentTokens = parentSpec
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  const outPath =
    resolveOptionalPath(flagValue(args, "--out")) ??
    (positionals.length >= 3 ? resolveOptionalPath(positionals[2]) : null);

  const graphPath = resolveOptionalPath(flagValue(args, "--append-graph"));

  return {
    content,
    contentSource: source,
    parentTokens,
    outPath,
    graphPath,
    validateParents: args.includes("--validate-parents"),
    json: args.includes("--json"),
    dryRun: args.includes("--dry-run"),
    positionals,
  };
}

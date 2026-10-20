#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { lstatSync, readFileSync, readdirSync } from "node:fs";
import { extname, join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

const TEXT_EXTENSIONS = new Set([
  ".cjs", ".css", ".html", ".js", ".json", ".md", ".mjs", ".py", ".rs",
  ".sh", ".sol", ".toml", ".ts", ".tsx", ".txt", ".yaml", ".yml",
]);

const EXCLUDED_DIRECTORIES = new Set([
  ".git", ".mypy_cache", ".pytest_cache", ".ruff_cache", ".stryker-tmp",
  ".venv", "__pycache__", "_site", "artifacts", "build", "cache",
  "coverage", "dist", "node_modules", "target", "typechain-types",
]);

export function runGit(args, cwd = process.cwd()) {
  return spawnSync("git", args, { cwd, encoding: "utf8", shell: false });
}

export function runDiffCheck(args, cwd = process.cwd()) {
  return runGit(["diff", "--check", ...args], cwd);
}

export function isGitWorkTree(cwd = process.cwd()) {
  const result = runGit(["rev-parse", "--is-inside-work-tree"], cwd);
  return result.status === 0 && result.stdout.trim() === "true";
}

export function formatFailure(result) {
  if (result.error) return result.error.message;
  return [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
}

export function findWhitespaceProblems(source, relativePath) {
  if (source.includes("\0")) return [];
  const problems = [];
  const lines = source.replace(/\r\n/gu, "\n").split("\n");
  for (let index = 0; index < lines.length; index++) {
    if (/[\t ]+$/u.test(lines[index])) {
      problems.push(`${relativePath}:${index + 1}: trailing whitespace`);
    }
  }
  return problems;
}

export function listUntrackedTextFiles(cwd = process.cwd()) {
  const result = runGit(["ls-files", "--others", "--exclude-standard", "-z"], cwd);
  if (result.status !== 0) throw new Error(formatFailure(result) || "git ls-files failed");
  return result.stdout
    .split("\0")
    .filter(Boolean)
    .filter((relativePath) => TEXT_EXTENSIONS.has(extname(relativePath).toLowerCase()));
}

export function listArchiveTextFiles(cwd = process.cwd()) {
  const root = resolve(cwd);
  const files = [];
  function visit(directory) {
    for (const name of readdirSync(directory).sort()) {
      if (EXCLUDED_DIRECTORIES.has(name)) continue;
      const absolutePath = join(directory, name);
      const stats = lstatSync(absolutePath);
      if (stats.isSymbolicLink()) continue;
      if (stats.isDirectory()) {
        visit(absolutePath);
      } else if (stats.isFile() && TEXT_EXTENSIONS.has(extname(name).toLowerCase())) {
        files.push(relative(root, absolutePath).split(sep).join("/"));
      }
    }
  }
  visit(root);
  return files;
}

export function checkTextFiles(relativePaths, cwd = process.cwd()) {
  const problems = [];
  for (const relativePath of relativePaths) {
    let source;
    try {
      source = readFileSync(resolve(cwd, relativePath), "utf8");
    } catch (error) {
      problems.push(`${relativePath}: ${error.message}`);
      continue;
    }
    problems.push(...findWhitespaceProblems(source, relativePath));
  }
  return problems;
}

export function checkUntrackedFiles(cwd = process.cwd()) {
  return checkTextFiles(listUntrackedTextFiles(cwd), cwd);
}

function main() {
  const gitWorkTree = isGitWorkTree();
  const failures = [];
  if (gitWorkTree) {
    failures.push(...[runDiffCheck([]), runDiffCheck(["--cached"])]
      .filter((result) => result.status !== 0)
      .map(formatFailure)
      .filter(Boolean));
    failures.push(...checkUntrackedFiles());
  } else {
    failures.push(...checkTextFiles(listArchiveTextFiles()));
  }

  if (failures.length > 0) {
    process.stderr.write(`${failures.join("\n")}\n`);
    process.exitCode = 1;
    return;
  }
  const scope = gitWorkTree ? "tracked changes and untracked text files" : "exported source files";
  process.stdout.write(`Formatting and whitespace check passed (${scope}).\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main();
}

#!/usr/bin/env node
/**
 * Export Mermaid diagrams from docs/whitepaper-diagrams.md to PNG files.
 *
 * Usage: node scripts/docs/export-whitepaper-diagrams.js
 * Requires: @mermaid-js/mermaid-cli (mmdc)
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const SOURCE_MD = path.join(ROOT, "docs/whitepaper-diagrams.md");
const OUT_DIR = path.join(ROOT, "docs/assets/whitepaper-figures");
const MERMAID_CONFIG = path.join(OUT_DIR, "mermaid-theme.json");
const MMDC_CLI = path.join(
  ROOT,
  "node_modules/@mermaid-js/mermaid-cli/src/cli.js",
);

const FIGURE_HEADING = /^### Figure (\d+) — (.+)$/;
const INSET_HEADING = /^#### Hash Distinction/;

function slugify(text) {
  return text
    .replace(/\s*\*?\([^)]*\)\*?/g, "")
    .toLowerCase()
    .replace(/[`'"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function extractDiagrams(markdown) {
  const lines = markdown.split(/\r?\n/);
  const diagrams = [];
  let currentFigure = null;
  let currentInset = false;
  let inMermaid = false;
  let buffer = [];

  for (const line of lines) {
    const figureMatch = line.match(FIGURE_HEADING);
    if (figureMatch) {
      currentFigure = { num: figureMatch[1], title: figureMatch[2].trim() };
      currentInset = false;
    } else if (INSET_HEADING.test(line)) {
      currentInset = true;
    }

    if (line.trim() === "```mermaid") {
      inMermaid = true;
      buffer = [];
      continue;
    }

    if (inMermaid && line.trim() === "```") {
      inMermaid = false;
      if (!currentFigure) continue;

      const suffix = currentInset ? "hash-distinction-inset" : slugify(currentFigure.title);
      const id = currentInset
        ? `figure-${currentFigure.num.padStart(2, "0")}a-${suffix}`
        : `figure-${currentFigure.num.padStart(2, "0")}-${suffix}`;

      diagrams.push({
        id,
        figureNum: currentFigure.num,
        title: currentInset
          ? `Figure ${currentFigure.num} (inset) — Hash Distinction`
          : `Figure ${currentFigure.num} — ${currentFigure.title}`,
        source: buffer.join("\n"),
      });
      currentInset = false;
      continue;
    }

    if (inMermaid) buffer.push(line);
  }

  return diagrams;
}

function exportPng(diagram) {
  const mmdPath = path.join(OUT_DIR, `${diagram.id}.mmd`);
  const pngPath = path.join(OUT_DIR, `${diagram.id}.png`);

  fs.writeFileSync(mmdPath, diagram.source, "utf8");

  const width = diagram.id === "figure-05-derivation-graph-and-pathcount" ? "4000" : "2400";

  const args = [
    MMDC_CLI,
    "-i",
    mmdPath,
    "-o",
    pngPath,
    "-b",
    "white",
    "-s",
    "2",
    "-w",
    width,
    "-c",
    MERMAID_CONFIG,
  ];

  const result = spawnSync(process.execPath, args, {
    stdio: "inherit",
    cwd: ROOT,
  });

  if (result.status !== 0) {
    throw new Error(`mmdc failed for ${diagram.id} (exit ${result.status})`);
  }

  return pngPath;
}

function main() {
  if (!fs.existsSync(SOURCE_MD)) {
    console.error(`Source not found: ${SOURCE_MD}`);
    process.exit(1);
  }

  if (!fs.existsSync(MMDC_CLI)) {
    console.error("mmdc not found. Run: pnpm add -D @mermaid-js/mermaid-cli@10.9.1");
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const markdown = fs.readFileSync(SOURCE_MD, "utf8");
  const diagrams = extractDiagrams(markdown);

  if (diagrams.length === 0) {
    console.error("No Mermaid diagrams found.");
    process.exit(1);
  }

  const manifest = [];

  for (const diagram of diagrams) {
    console.log(`Exporting ${diagram.id}.png …`);
    exportPng(diagram);
    manifest.push({
      id: diagram.id,
      title: diagram.title,
      png: `docs/assets/whitepaper-figures/${diagram.id}.png`,
      mmd: `docs/assets/whitepaper-figures/${diagram.id}.mmd`,
    });
  }

  fs.writeFileSync(
    path.join(OUT_DIR, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );

  console.log(`\nExported ${diagrams.length} PNG(s) to ${OUT_DIR}`);
}

main();

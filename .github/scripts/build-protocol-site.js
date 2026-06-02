#!/usr/bin/env node

/**
 * Build GitHub Pages _site/ from:
 *   1. Protocol JSON artifacts (by $id URL path)
 *   2. docs/whitepaper.md → _site/whitepaper/index.html
 *
 * Zero npm dependencies — pure Node built-ins.
 */

import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  statSync,
  copyFileSync,
  existsSync,
} from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SCHEMA_HOST = "https://xandrlabs.github.io/alx-protocol";
const SITE_ROOT = join(REPO_ROOT, "_site");
const PROTOCOL_ROOT = join(REPO_ROOT, "protocol");

function walkJson(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      walkJson(full, out);
    } else if (name.endsWith(".json")) {
      out.push(full);
    }
  }
  return out;
}

function ensureDir(filePath) {
  mkdirSync(dirname(filePath), { recursive: true });
}

mkdirSync(SITE_ROOT, { recursive: true });

// retrieval-api.yaml (no $id — copy by known path)
const retrievalApiSrc = join(PROTOCOL_ROOT, "retrieval-api.yaml");
const retrievalApiDest = join(SITE_ROOT, "protocol/1/retrieval-api.yaml");
if (existsSync(retrievalApiSrc)) {
  ensureDir(retrievalApiDest);
  copyFileSync(retrievalApiSrc, retrievalApiDest);
  console.log("  copied protocol/1/retrieval-api.yaml");
}

// All JSON files with a matching $id
let count = 0;
for (const jsonFile of walkJson(PROTOCOL_ROOT)) {
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(jsonFile, "utf-8"));
  } catch {
    continue;
  }

  const id = parsed.$id;
  if (typeof id !== "string" || !id.startsWith(`${SCHEMA_HOST}/`)) {
    continue;
  }

  const relPath = id.slice(SCHEMA_HOST.length + 1); // strip leading slash too
  const dest = join(SITE_ROOT, relPath);
  ensureDir(dest);
  writeFileSync(dest, readFileSync(jsonFile, "utf-8"));
  console.log(`  copied ${relPath}`);
  count += 1;
}

console.log(`\nBuilt ${count} protocol artifacts into ${SITE_ROOT}`);

// ── Whitepaper ────────────────────────────────────────────────────────────────

const whitepaperSrc = join(REPO_ROOT, "docs/whitepaper.md");
if (existsSync(whitepaperSrc)) {
  const md = readFileSync(whitepaperSrc, "utf-8");
  const html = renderMarkdown(md);
  const dest = join(SITE_ROOT, "whitepaper/index.html");
  ensureDir(dest);
  writeFileSync(dest, html);
  console.log("  rendered docs/whitepaper.md → whitepaper/index.html");
}

// ── Markdown renderer (no deps) ───────────────────────────────────────────────

function escHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inlineFormat(s) {
  // **bold**, `code`, [text](url)
  return escHtml(s)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

function renderMarkdown(src) {
  const lines = src.split("\n");
  let out = "";
  let i = 0;

  const CSS = `
    :root { --accent: #1a3f6f; --text: #1c1c1c; --muted: #555; --bg: #fff; --rule: #ddd; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: "Georgia", serif; font-size: 17px; line-height: 1.75;
           color: var(--text); background: var(--bg); max-width: 800px;
           margin: 0 auto; padding: 2.5rem 1.5rem 5rem; }
    h1 { font-size: 2rem; color: var(--accent); border-bottom: 2px solid var(--accent);
         padding-bottom: .4rem; margin: 2.5rem 0 1rem; }
    h2 { font-size: 1.45rem; color: var(--accent); margin: 2rem 0 .7rem; }
    h3 { font-size: 1.15rem; color: var(--accent); margin: 1.6rem 0 .5rem; }
    h4, h5 { font-size: 1rem; font-style: italic; color: var(--muted);
              margin: 1.2rem 0 .4rem; }
    p { margin: .7rem 0; }
    hr { border: none; border-top: 1px solid var(--rule); margin: 2rem 0; }
    ul, ol { margin: .7rem 0 .7rem 1.8rem; }
    li { margin: .2rem 0; }
    pre { background: #f4f4f4; border: 1px solid #ddd; border-radius: 4px;
          padding: 1rem; overflow-x: auto; margin: 1rem 0; }
    code { font-family: "Courier New", monospace; font-size: .88em; }
    pre code { font-size: .83em; }
    table { border-collapse: collapse; width: 100%; margin: 1rem 0; font-size: .9rem; }
    th, td { border: 1px solid #ccc; padding: .4rem .7rem; text-align: left; }
    th { background: #eef2f7; font-weight: bold; }
    tr:nth-child(even) td { background: #f9f9f9; }
    strong { font-weight: 700; }
    a { color: var(--accent); }
    .meta { color: var(--muted); font-size: .88rem; font-style: italic;
            border-left: 3px solid var(--rule); padding-left: .8rem; margin: 1rem 0; }
  `;

  function flush(tag, content) {
    out += `<${tag}>${content}</${tag}>\n`;
  }

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      i++;
      let code = "";
      while (i < lines.length && !lines[i].startsWith("```")) {
        code += escHtml(lines[i]) + "\n";
        i++;
      }
      i++; // consume closing ```
      out += `<pre><code${lang ? ` class="language-${lang}"` : ""}>${code}</code></pre>\n`;
      continue;
    }

    // HR
    if (/^---+$/.test(line.trim())) {
      out += "<hr>\n";
      i++;
      continue;
    }

    // Headings
    const hm = line.match(/^(#{1,5})\s+(.+)$/);
    if (hm) {
      const lvl = hm[1].length;
      const slug = hm[2].toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-");
      out += `<h${lvl} id="${slug}">${inlineFormat(hm[2])}</h${lvl}>\n`;
      i++;
      continue;
    }

    // Table
    if (line.startsWith("|")) {
      let rows = [];
      while (i < lines.length && lines[i].startsWith("|")) {
        const cells = lines[i].split("|").slice(1, -1).map((c) => c.trim());
        // skip separator row
        if (!cells.every((c) => /^[-:\s]+$/.test(c))) rows.push(cells);
        i++;
      }
      if (rows.length) {
        out += "<table>\n";
        rows.forEach((row, ri) => {
          out += "<tr>" + row.map((c) => ri === 0 ? `<th>${inlineFormat(c)}</th>` : `<td>${inlineFormat(c)}</td>`).join("") + "</tr>\n";
        });
        out += "</table>\n";
      }
      continue;
    }

    // Unordered list
    if (/^[-•]\s/.test(line) || /^\s{2,}[-•]\s/.test(line)) {
      out += "<ul>\n";
      while (i < lines.length && (/^[-•]\s/.test(lines[i]) || /^\s{2,}[-•]\s/.test(lines[i]))) {
        out += `<li>${inlineFormat(lines[i].replace(/^\s*[-•]\s+/, ""))}</li>\n`;
        i++;
      }
      out += "</ul>\n";
      continue;
    }

    // Ordered list
    if (/^\d+\.\s/.test(line)) {
      out += "<ol>\n";
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        out += `<li>${inlineFormat(lines[i].replace(/^\d+\.\s+/, ""))}</li>\n`;
        i++;
      }
      out += "</ol>\n";
      continue;
    }

    // Blank line
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Metadata block at top (key: value lines)
    if (/^(Status|Authority|Protocol scope|Release role|Audience|Last reviewed):\s/.test(line)) {
      let meta = "";
      while (i < lines.length && /^\S[^:]+:\s/.test(lines[i]) && lines[i].trim() !== "") {
        meta += inlineFormat(lines[i]) + "<br>\n";
        i++;
      }
      out += `<p class="meta">${meta}</p>\n`;
      continue;
    }

    // Regular paragraph (collect contiguous non-special lines)
    let para = "";
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].startsWith("#") &&
      !lines[i].startsWith("|") &&
      !lines[i].startsWith("```") &&
      !/^[-•]\s/.test(lines[i]) &&
      !/^\d+\.\s/.test(lines[i]) &&
      !/^---+$/.test(lines[i].trim())
    ) {
      para += (para ? " " : "") + lines[i].trimEnd();
      i++;
    }
    if (para) out += `<p>${inlineFormat(para)}</p>\n`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ALX Protocol Whitepaper</title>
<style>${CSS}</style>
</head>
<body>
${out}
</body>
</html>`;
}

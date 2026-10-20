import { traceAttribution } from "../lib/cli-context.js";
import { CliInputError } from "../lib/cli-args.js";
import {
  graphMap,
  loadGraphSource,
  navigationRecord,
  resolveGraphReference,
  reverseGraph,
} from "../lib/graph-source.js";
import { bold, die, dim, green, json, red } from "../lib/cli-utils.js";
import { cmdValidate } from "./block.js";

const NAVIGATION_COMMANDS = new Set([
  "parents",
  "children",
  "ancestors",
  "descendants",
]);

export async function cmdGraph(args) {
  const sub = args[0];
  const rest = args.slice(1);
  if (sub === "verify") return cmdValidate(rest);
  if (sub === "trace") return cmdTrace(rest);
  if (NAVIGATION_COMMANDS.has(sub)) return cmdNavigate(sub, rest);
  die(
    "Usage: alx graph <parents|children|ancestors|descendants|trace|verify>",
  );
}

function parseQueryArgs(args, command) {
  const reference = args[0];
  if (!reference || reference.startsWith("--")) {
    die(`Usage: alx graph ${command} <reference> [--file <graph.json>] [--json]`);
  }

  let file = null;
  let useJson = false;
  for (let index = 1; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--json") {
      useJson = true;
    } else if (arg === "--file") {
      if (!args[index + 1] || args[index + 1].startsWith("--")) {
        die("--file requires a Graph JSON path");
      }
      file = args[index + 1];
      index += 1;
    } else {
      die(`Unknown option for alx graph ${command}: ${arg}`);
    }
  }
  return { reference, file, useJson };
}

function loadQuery(command, args) {
  const parsed = parseQueryArgs(args, command);
  try {
    const source = loadGraphSource({ file: parsed.file });
    const resolved = resolveGraphReference(parsed.reference, source);
    return { ...parsed, source, resolved };
  } catch (err) {
    if (err instanceof CliInputError) die(err.message);
    throw err;
  }
}

function parentsFor(source, resolved) {
  const node = source.nodes.get(resolved.blockHash);
  const parents = node?.parentHashes ?? resolved.parentHashes;
  if (!parents) {
    throw new CliInputError(
      `Parent declarations for ${resolved.blockHash} are unavailable in the selected graph source`,
    );
  }
  return parents;
}

function sortRecords(records) {
  return records.sort(
    (a, b) => a.depth - b.depth || a.blockHash.localeCompare(b.blockHash),
  );
}

function directNavigation(command, source, resolved) {
  if (command === "parents") {
    return {
      hashes: parentsFor(source, resolved),
      completeness: "complete",
    };
  }
  return {
    hashes: reverseGraph(source).get(resolved.blockHash) ?? [],
    completeness: "source-relative",
  };
}

function traverseAncestors(source, resolved) {
  const graph = graphMap(source, resolved);
  if (!graph.has(resolved.blockHash)) parentsFor(source, resolved);

  const depths = new Map();
  const queue = [[resolved.blockHash, 0]];
  let head = 0;
  let complete = true;
  const expanded = new Set();

  while (head < queue.length) {
    const [hash, depth] = queue[head++];
    if (expanded.has(hash)) continue;
    expanded.add(hash);
    for (const parent of graph.get(hash) ?? []) {
      if (parent === resolved.blockHash) continue;
      const nextDepth = depth + 1;
      if (!depths.has(parent) || nextDepth < depths.get(parent)) {
        depths.set(parent, nextDepth);
      }
      if (graph.has(parent)) queue.push([parent, nextDepth]);
      else complete = false;
    }
  }

  return {
    records: sortRecords(
      [...depths].map(([hash, depth]) => navigationRecord(hash, depth, source)),
    ),
    completeness: complete ? "complete" : "partial",
  };
}

function traverseDescendants(source, resolved) {
  const reverse = reverseGraph(source);
  const depths = new Map();
  const queue = [[resolved.blockHash, 0]];
  let head = 0;
  const expanded = new Set();

  while (head < queue.length) {
    const [hash, depth] = queue[head++];
    if (expanded.has(hash)) continue;
    expanded.add(hash);
    for (const child of reverse.get(hash) ?? []) {
      if (child === resolved.blockHash) continue;
      const nextDepth = depth + 1;
      if (!depths.has(child) || nextDepth < depths.get(child)) {
        depths.set(child, nextDepth);
      }
      queue.push([child, nextDepth]);
    }
  }

  return {
    records: sortRecords(
      [...depths].map(([hash, depth]) => navigationRecord(hash, depth, source)),
    ),
    completeness: "source-relative",
  };
}

function navigationOutput(command, source, root, records, completeness) {
  return {
    relationship: command,
    root,
    source: source.descriptor,
    completeness,
    count: records.length,
    blocks: records,
  };
}

function printNavigation(result) {
  console.log(`\n${bold(`Graph ${result.relationship}`)}\n`);
  console.log(`  ${bold("Root")}          ${result.root}`);
  console.log(`  ${bold("Source")}        ${result.source.type}: ${result.source.path}`);
  console.log(`  ${bold("Completeness")}  ${result.completeness}`);
  console.log(`  ${bold("Count")}         ${result.count}\n`);
  for (const block of result.blocks) {
    const availability = block.available ? green("available") : dim("unavailable");
    console.log(`  ${block.blockHash}  depth=${block.depth}  ${availability}`);
  }
  if (result.completeness === "source-relative") {
    console.log(dim("\n  Downward results include only Blocks observed by the selected source."));
  }
  console.log();
}

function cmdNavigate(command, args) {
  const { source, resolved, useJson } = loadQuery(command, args);
  try {
    let records;
    let completeness;
    if (command === "ancestors") {
      ({ records, completeness } = traverseAncestors(source, resolved));
    } else if (command === "descendants") {
      ({ records, completeness } = traverseDescendants(source, resolved));
    } else {
      const direct = directNavigation(command, source, resolved);
      records = direct.hashes.map((hash) => navigationRecord(hash, 1, source));
      completeness = direct.completeness;
    }
    const output = navigationOutput(
      command,
      source,
      resolved.blockHash,
      sortRecords(records),
      completeness,
    );
    if (useJson) json(output);
    else printNavigation(output);
  } catch (err) {
    if (err instanceof CliInputError) die(err.message);
    throw err;
  }
}

function cmdTrace(args) {
  const { source, resolved, useJson } = loadQuery("trace", args);
  const graph = graphMap(source, resolved);
  if (!graph.has(resolved.blockHash)) {
    die(`Block ${resolved.blockHash} has no parent declaration in the selected graph source`);
  }

  const trace = traceAttribution(resolved.blockHash, graph);
  if (useJson) {
    json(trace);
    return;
  }

  console.log(`\n${bold("Attribution Trace")}\n`);
  console.log(`  ${bold("Root")}       ${trace.root}`);
  console.log(`  ${bold("Source")}     ${source.descriptor.type}: ${source.descriptor.path}`);
  console.log(`  ${bold("Nodes")}      ${trace.nodes.length}`);
  console.log(`  ${bold("Edges")}      ${trace.edges.length}`);
  console.log(`  ${bold("Leaves")}     ${trace.leaves.length}`);
  console.log(`  ${bold("Max depth")}  ${trace.maxDepth}`);
  console.log(`  ${bold("Complete")}   ${trace.complete ? green("yes") : red("no")}`);
  console.log(`  ${bold("Mode")}       ${trace.validationMode}\n`);
  console.log(`  ${bold("Nodes")} ${dim("(sorted by depth)")}`);
  for (const node of trace.nodes) {
    const indexed = source.nodes.get(node.hash);
    const label = indexed?.contentType ? `  ${dim(`[${indexed.contentType}]`)}` : "";
    const pathInfo = node.pathCount !== "1" ? ` ${dim(`(${node.pathCount} paths)`)}` : "";
    console.log(`    ${node.hash} depth=${node.minDepth}${pathInfo}${label}`);
  }
  console.log();
}

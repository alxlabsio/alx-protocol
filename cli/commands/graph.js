import { buildGraph, traceAttribution } from "../lib/cli-context.js";
import {
  bold,
  die,
  dim,
  green,
  json,
  parseJson,
  readInput,
  red,
} from "../lib/cli-utils.js";
import { cmdValidate } from "./block.js";

export async function cmdGraph(args) {
  const sub = args[0];
  const rest = args.slice(1);
  if (sub === "verify") return cmdValidate(rest);
  if (sub === "trace") return cmdTrace(rest);
  die("Usage: alx graph verify | trace");
}

function cmdTrace(args) {
  const rootHash = args[0];
  if (!rootHash || rootHash.startsWith("--"))
    die("Usage: alx graph trace <root-hash> --file <graph.json>");

  const remaining = args.slice(1);
  const input = readInput(remaining);
  const data = parseJson(input);

  let graph;
  const contentTypes = new Map(); // hash → content.type label
  if (Array.isArray(data)) {
    graph = buildGraph(data);
    for (const b of data) {
      if (
        b.blockHash &&
        b.content &&
        typeof b.content === "object" &&
        b.content.type
      ) {
        contentTypes.set(b.blockHash.toLowerCase(), String(b.content.type));
      }
    }
  } else if (data && typeof data === "object") {
    graph = new Map(
      Object.entries(data).map(([k, v]) => [k, Array.isArray(v) ? v : []]),
    );
  } else {
    die("Input must be an array of blocks or a hash\u2192parents object");
  }

  // Resolve prefix hash to full hash (allows short hashes like 0x6fbf65cb...)
  let resolvedHash = rootHash;
  const prefix = rootHash.toLowerCase().replace(/\.\.\.$/, "");
  const allHashes = [...graph.keys()];
  const matches = allHashes.filter((h) => h.toLowerCase().startsWith(prefix));
  if (matches.length === 1) {
    resolvedHash = matches[0];
  } else if (matches.length > 1) {
    die(
      `Ambiguous hash prefix '${rootHash}' matches ${matches.length} blocks. Provide more characters.`,
    );
  }

  const trace = traceAttribution(resolvedHash, graph);

  if (remaining.includes("--json")) {
    json(trace);
  } else {
    console.log(`\n${bold("Attribution Trace")}\n`);
    console.log(`  ${bold("Root")}       ${trace.root.slice(0, 18)}...`);
    console.log(`  ${bold("Nodes")}      ${trace.nodes.length}`);
    console.log(`  ${bold("Edges")}      ${trace.edges.length}`);
    console.log(`  ${bold("Leaves")}     ${trace.leaves.length}`);
    console.log(`  ${bold("Max depth")}  ${trace.maxDepth}`);
    console.log(
      `  ${bold("Cycles")}     ${trace.cycle ? red("YES") : green("none")}`,
    );
    console.log();
    console.log(`  ${bold("Nodes")} ${dim("(sorted by depth)")}`);
    for (const node of trace.nodes) {
      const indent = "  ".repeat(node.minDepth);
      const pathInfo =
        node.pathCount > 1 ? ` ${dim(`(${node.pathCount} paths)`)}` : "";
      const label = contentTypes.has(node.hash)
        ? `  ${dim("[" + contentTypes.get(node.hash) + "]")}`
        : "";
      console.log(
        `    ${indent}${node.hash.slice(0, 18)}... depth=${node.minDepth}${pathInfo}${label}`,
      );
    }
    console.log();
    console.log(`  ${bold("Leaves")} ${dim("(original sources)")}`);
    for (const leaf of trace.leaves) {
      const label = contentTypes.has(leaf)
        ? `  ${dim("[" + contentTypes.get(leaf) + "]")}`
        : "";
      console.log(`    ${leaf.slice(0, 18)}...${label}`);
    }
    console.log();
    const hasMultiPath = trace.nodes.some((n) => n.pathCount > 1);
    if (hasMultiPath) {
      console.log(
        dim(
          "  pathCount = independent causal paths from root to that ancestor",
        ),
      );
    }
    console.log(dim("  Use --json for machine-readable output"));
    console.log();
  }
}

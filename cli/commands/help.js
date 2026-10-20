import { ALX_VERSION } from "../lib/cli-context.js";
import { bold, dim } from "../lib/cli-utils.js";

export function usage() {
  console.log(`
${bold("alx")} - ALX Protocol CLI v${ALX_VERSION}

${bold("Project")}
  alx doctor
  alx version

${bold("Blocks")}
  alx block create <file> [--parent <reference>]...
      [--verify-parents] [--out <path>] [--dry-run] [--json]
  alx block create --content <json> | --content-file <path> | --content -
  alx block create --from-ipfs <cid> | --from-s3 <uri> | --from-url <url>
  alx block show <hash|prefix|@last|file>
  alx block verify <hash|prefix|@last|file>
  alx block list [--recent N|--all] [--json]
  alx block publish <file> [--ipfs <endpoint>] [--endpoint <url>]
      [--api-key <key>] [--cid-map <path>] [--gateway <url>] [--json]
  alx block resolve <blockHash> [--endpoint <url>] [--gateway <url>]
      [--cid-map <path>] [--json]

${bold("Graphs")}
  alx graph parents <reference> [--file <graph.json>] [--json]
  alx graph children <reference> [--file <graph.json>] [--json]
  alx graph ancestors <reference> [--file <graph.json>] [--json]
  alx graph descendants <reference> [--file <graph.json>] [--json]
  alx graph verify <file>
  alx graph trace <reference> [--file <graph.json>] [--json]

${bold("Anchoring")}
  alx anchor create <block.json> [--rpc-url <url>] [--private-key <key>] [--json]
  alx anchor create --hashes <h1,h2,...> [--batch-id <id>]
      [--rpc-url <url>] [--private-key <key>] [--json]
  alx anchor status <blockHash> [--rpc-url <url>] [--json]

${bold("Services")}
  alx server start [--port 8080]
  alx retrieval start [--port 8081] [--data-dir <path>] [--gateway <url>]

${bold("Tests and conformance")}
  alx test run <tests-block.json> --against <validator-block.json>
  alx test-vectors run
  alx conformance run [--impl <command>]
  alx extension-conformance <merkle|signing> [--impl <command>]

${bold("Parent references")}
  Full blockHash, unique indexed prefix, Block file, or @last.
  @last resolves the last Block persisted in the nearest .alx project store.
  Use --verify-parents to require available and valid local parent Blocks.

${bold("Graph sources")}
  Graph queries use the nearest .alx project index by default.
  --file accepts a Block array or a hash-to-parents adjacency object.
  Parents and ancestors follow declarations. Children and descendants are
  limited to Blocks observed by the selected source.

${bold("Examples")}
  alx block create source.md
  alx block create analysis.md --parent '@last'
  alx block create decision.json --parent '@last'
  alx block list --all
  alx block show '@last'
  alx block verify '@last'

${dim("Protocol spec: protocol/spec.md\nCommand reference: cli/README.md")}
`);
}

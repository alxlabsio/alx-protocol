import { ALX_VERSION } from "../lib/cli-context.js";
import { bold, dim } from "../lib/cli-utils.js";

export function usage() {
  console.log(`
${bold("alx")} — ALX Protocol CLI v${ALX_VERSION}

${bold("Commands:")}
  alx init [dir]                 Create a minimal starter project with example blocks
  alx init --provider <s3|ipfs|retrieval>
                                 Write storage provider config stubs to .env
  alx doctor                     Check environment: Node version, .env, IPFS, S3, retrieval server
  alx version                    Show version info

${bold("block")}
  alx block create <file> [--parent <reference>] [--parents <references>] [--dry-run]
                                 Create and locally persist a Block from JSON or UTF-8 text
  alx block create --from-ipfs <cid> [--out file]
                                 Fetch a CID via IPFS gateway and lock into a block
  alx block create --from-s3 <s3://bucket/key> [--out file]
                                 Fetch an S3 object and lock into a block
  alx block create --from-url <url> [--out file]
                                 Fetch any HTTP URL and lock into a block
  alx block link [<content.json>] <parent>[,...] [out.block.json] [--dry-run]
                                 Parent: file, 0x hash, @last, @latest, or @parent
  alx block show <reference>     Print a Block by hash, prefix, @last, or file
  alx block verify <reference>   Verify a Block by hash, prefix, @last, or file
  alx block inspect <file>       Explain a block field-by-field
  alx block proof <file>         Show cryptographic proof walkthrough
  alx block publish <file> [--ipfs <endpoint>] [--endpoint <url>] [--api-key <key>] [--cid-map <path>]
                                 Pin to IPFS and/or publish to a retrieval server
  alx block resolve <blockHash> [--endpoint <url>] [--gateway <url>] [--cid-map <path>]
                                 Fetch and verify a Block from HTTP, IPFS, or a local mapping
  alx block list [--recent N|--all] [--json]
                                 List recent or all indexed project Blocks
  alx block types [--json]       List known advisory content type schemas

${bold("graph")}
  alx graph verify <file>        Verify all block hashes in a graph (cryptographic)
  alx graph trace <hash> --file <f>
                                 Trace attribution through a derivation graph

${bold("anchor")}
  alx anchor create <file> [--rpc-url <url>] [--private-key <key>]
                                 Anchor a block's blockHash on Base (ALXAnchor)
  alx anchor create --hashes <h1,h2,...> [--batch-id <id>] [--rpc-url <url>] [--private-key <key>]
                                 Anchor a hash batch (2+ hashes) on Base
  alx anchor status <blockHash> [--rpc-url <url>]
                                 Query on-chain anchor status for a blockHash

${bold("server / retrieval")}
  alx server start [--port 8080] Start verification API server
  alx retrieval start [--port 8081] [--data-dir <path>]
                                 Start block retrieval API server (shared team store)

${bold("test / conformance")}
  alx test run <tests> --against <v>
                                 Run acceptance tests from a locked tests block
  alx test-vectors run           Run hash test vectors (self-test)
  alx conformance run            Run protocol conformance suite
  alx conformance run --impl <c> Test an external implementation
  alx extension-conformance merkle
                                 Run optional Merkle extension tests
  alx extension-conformance signing
                                 Run optional signing extension tests

${bold("Examples:")}
  alx block verify protocol/graph.json
  alx block inspect protocol/07-generated-validator.block.json
  alx test run protocol/06-validator-tests.block.json --against protocol/07-generated-validator.block.json
  alx graph trace 0xabc... --file protocol/graph.json
  alx test-vectors run
  alx server start --port 8080
  alx retrieval start --port 8081
  alx block publish research.block.json --endpoint http://localhost:8081
  alx block resolve 0xabc... --endpoint http://localhost:8081
  alx anchor create research.block.json --rpc-url https://sepolia.base.org
  alx anchor create --hashes 0xaaa...,0xbbb... --batch-id 0xccc... --rpc-url https://sepolia.base.org
  alx anchor status 0xabc... --rpc-url https://sepolia.base.org --json

${bold("Machine-readable:")}
  alx block create --content '{"x":1}' --json
  alx block create --content-file ./data.json --out new.block.json
  alx block create ./data.json --parent '@last'
  alx block create ./merge.json --parent 0xabc... --parent 0xdef...
  alx block create --content-file ./data.json --dry-run
  alx block create --from-ipfs bafybei... --out imported.block.json
  alx block create --from-s3 s3://my-bucket/report.pdf --out report.block.json
  alx block create --from-url https://api.example.com/data.json --out data.block.json
  alx block link ./ai-response.json research.block.json synthesis.block.json
  alx block link ./data.json @latest child.block.json
  alx block link ./data.json @latest out.block.json --dry-run --json
  alx block list --recent 5
  alx block list --all --json
  cat content.json | alx block link --parent parent.block.json --out child.block.json
  alx graph trace 0xabc... --file graph.json --json

${dim(`Protocol spec: protocol/spec.md`)}
`);
}

// ── Router ──

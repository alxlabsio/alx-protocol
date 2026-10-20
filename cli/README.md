# @alx-protocol/cli

The ALX Protocol CLI creates, stores, verifies, retrieves, and anchors Blocks. CLI behavior is tooling behavior; protocol validity remains defined by the [specification](https://alxprotocol.com/documentation/specification/), the [JSON schemas](https://alxprotocol.com/documentation/reference/json-schemas), and the [conformance vectors](https://alxprotocol.com/documentation/conformance/vectors).

## Install

```bash
npm install -g @alx-protocol/cli
```

`@alx-protocol/cli` 1.0.0 on npm fails to start because it imports a module the package does not include. Use version 1.0.1 or later; until it is published, run the CLI from a repository clone.

From a repository clone:

```bash
pnpm install
pnpm build
node cli/bin/alx.js --help
```

## Local Block Workflow

Create a root Block, create two derived Blocks, inspect the project index, and verify the current head:

```bash
alx block create --content '{"type":"research","summary":"Collect Q4 infrastructure data"}'
alx block create --content '{"type":"analysis","summary":"Evaluate the collected data"}' --parent @last
alx block create --content '{"type":"decision","summary":"Approve the infrastructure plan"}' --parent @last
alx block list --all
alx block show @last
alx block verify @last
```

Every non-dry-run creation stores a canonical copy at `.alx/blocks/<blockHash>.block.json`. The project index is stored in `.alx/state.json`. `--out` writes an additional copy.

## Directory Structure

| Path | Responsibility |
|---|---|
| `bin/alx.js` | Process bootstrap and top-level dispatch |
| `commands/` | Command handlers grouped by public command noun |
| `lib/` | Argument parsing, local state, graph sources, storage providers, and SDK integration |
| `server/` | Verification and retrieval HTTP services |
| `__tests__/` | CLI behavioral and regression tests |
| `openapi.yaml` | Informative verification HTTP API description |
| `Dockerfile` | Verification service container entry point |

The CLI imports canonical operations from `@alx-protocol/sdk`. Files under `cli/` define local storage, command routing, display, and transport behavior. They do not define Block validity.

## Content Inputs

`block create` resolves local content in precedence order.

| Source | Syntax | Commands |
|---|---|---|
| Inline JSON | `--content '<json>'` | `create` |
| JSON or UTF-8 text file | `--content-file <path>` | `create` |
| Positional file | `alx block create <path>` | `create` |
| Standard input | `--content -` or piped JSON | `create` |
| IPFS | `--from-ipfs <cid>` | `create` |
| S3-compatible storage | `--from-s3 <s3://bucket/key>` | `create` |
| HTTP | `--from-url <url>` | `create` |

`.json` files are parsed as JSON. Markdown, plain-text, CSV, and YAML files are represented as document content with a basename, media type, and exact text.

## Parent References

`block create` accepts one Block reference per repeatable `--parent` option. Parent hashes are resolved before Block identity is derived.

Accepted references are:

- a full `blockHash`, including a hash absent from local storage;
- a unique indexed hash prefix;
- a Block file path;
- `@last` for the last Block persisted in the nearest `.alx` project store.

`@last` is a local mutable selector. The resolved full hash, never the selector, is stored in `parentHashes`.

`--verify-parents` requires every parent reference to resolve to an available, valid local Block.

## Command Reference

### Project Commands

| Command | Purpose |
|---|---|
| `alx doctor` | Check Node.js and optional provider, retrieval, and Base configuration |
| `alx version` | Print the CLI and protocol versions |

### Block Commands

| Command | Purpose |
|---|---|
| `alx block create <file> [options]` | Derive identity from content and immutable parent hashes, then persist the Block |
| `alx block show <reference>` | Resolve a local reference and emit the complete stored Block JSON without validating it |
| `alx block verify <reference>` | Recompute Block identity and report whether the stored identity is valid |
| `alx block list [--recent N|--all] [--json]` | Enumerate indexed project Blocks without revalidating them |
| `alx block publish <file> [options]` | Publish a valid Block to IPFS, a retrieval server, or both |
| `alx block resolve <blockHash> [options]` | Retrieve and verify a Block from configured sources |

Creation options:

| Option | Effect |
|---|---|
| `--parent <reference>` | Add one parent; repeatable for merges |
| `--verify-parents` | Require all parents to resolve and validate locally |
| `--out <path>` | Write an additional Block copy |
| `--dry-run` | Compute the Block without writing files or state |
| `--json` | Emit machine-readable output |

Publication options:

| Option | Effect |
|---|---|
| `--ipfs <endpoint>` | Pin through an IPFS API endpoint |
| `--endpoint <url>` | Publish through the retrieval HTTP API |
| `--api-key <key>` | Authenticate a retrieval write |
| `--cid-map <path>` | Override the local Block-to-CID mapping path |
| `--gateway <url>` | Set the IPFS gateway used in output |

Resolution options are `--endpoint <url>`, `--gateway <url>`, `--cid-map <path>`, and `--json`.

### Graph Commands

| Command | Purpose |
|---|---|
| `alx graph parents <reference> [options]` | Return direct declared parents |
| `alx graph children <reference> [options]` | Return directly observed children from the selected source |
| `alx graph ancestors <reference> [options]` | Traverse declared parents recursively |
| `alx graph descendants <reference> [options]` | Traverse observed children recursively |
| `alx graph verify <file>` | Validate every Block and the Graph structure |
| `alx graph trace <reference> [options]` | Compute the protocol-defined Attribution Trace from a root Block |

Graph query options are `--file <graph.json>` and `--json`. Without `--file`, queries use the nearest `.alx/state.json` project index. A Graph file may contain either an array of Block objects or an adjacency object that maps each full `blockHash` to its `parentHashes` array.

Graph references accept a full hash, a unique indexed hash prefix, a Block file, or `@last`. Prefixes resolve against indexed Blocks in the selected source. `@last` resolves through the local project index.

### Graph Relationship Semantics

`parents` and `ancestors` follow immutable `parentHashes` declarations. A direct parent result is complete when the selected Block's parent declaration is available. Recursive ancestry is `partial` when traversal reaches a parent hash whose declaration is absent.

`children` and `descendants` reverse parent declarations observed in the selected source. Their completeness is always `source-relative`. The absence of an observed child does not prove that no Block outside the source references the target.

Traversal excludes the queried root from its results. Recursive results use the shortest discovered distance as `depth`. Results are ordered by `depth` and then `blockHash`.

`trace` remains distinct from navigation. It returns the protocol-defined `AttributionTrace`, including nodes, edges, minimum and maximum depths, `pathCount`, leaves, missing and external parents, validation mode, and completeness. Cyclic Graphs fail Trace construction.

### Graph JSON Output

Navigation commands return this shape:

```json
{
  "relationship": "children",
  "root": "0x...",
  "source": {
    "type": "local-index",
    "path": "/project/.alx/state.json",
    "globalCompleteness": "unknown"
  },
  "completeness": "source-relative",
  "count": 1,
  "blocks": [
    {
      "blockHash": "0x...",
      "depth": 1,
      "indexed": true,
      "available": true
    }
  ]
}
```

`indexed` reports whether the selected source contains a declaration for the returned Block. `available` reports whether Block bytes are locally available from that source. An adjacency-map entry is indexed but does not contain Block bytes.

`path`, `stats`, generic graph queries, and network-backed traversal are not CLI commands. Their data-source and result semantics are not defined in this version.

### Anchor Commands

Anchoring is optional infrastructure and does not affect Block validity.

| Command | Purpose |
|---|---|
| `alx anchor create <block.json> [options]` | Anchor one validated `blockHash` |
| `alx anchor create --hashes <h1,h2,...> [--batch-id <id>] [options]` | Anchor a batch containing at least two hashes |
| `alx anchor status <blockHash> [--rpc-url <url>] [--json]` | Query anchor state |

Write options are `--rpc-url <url>`, `--private-key <key>`, and `--json`.

### Service Commands

| Command | Purpose |
|---|---|
| `alx server start [--port 8080]` | Start the stateless verification API |
| `alx retrieval start [--port 8081] [--data-dir <path>] [--gateway <url>]` | Start the persistent retrieval API |

### Test and Conformance Commands

| Command | Purpose |
|---|---|
| `alx test run <tests-block.json> --against <validator-block.json>` | Run cases stored in a tests Block against supported validator code |
| `alx test-vectors run` | Run the built-in core conformance self-test |
| `alx conformance run` | Run the core conformance self-test |
| `alx conformance run --impl <command>` | Run core conformance against an external adapter |
| `alx extension-conformance merkle [--impl <command>]` | Run Merkle extension conformance |
| `alx extension-conformance signing [--impl <command>]` | Run signing extension conformance |

## JSON Output and Exit Status

Commands with `--json` emit JSON to standard output. Human-readable status output is the default.

Successful finite commands exit with status `0`. Invalid input, failed verification, unresolved required data, and failed conformance commands exit with a nonzero status. Long-running server commands continue until terminated.

## Verification HTTP API

`alx server start` exposes the API defined by [`openapi.yaml`](./openapi.yaml).

| Method | Path | Operation |
|---|---|---|
| `GET` | `/health` | Check server and SDK status |
| `GET` | `/version` | Read CLI and protocol versions |
| `GET` | `/openapi.yaml` | Read the OpenAPI definition |
| `POST` | `/block/create` | Create a Block |
| `POST` | `/block/validate` | Validate a Block |
| `POST` | `/trace` | Compute a Trace |

## Retrieval HTTP API

`alx retrieval start` implements the [retrieval API](https://alxprotocol.com/documentation/reference/rest-api).

| Method | Path | Operation |
|---|---|---|
| `GET` | `/health` | Check service status |
| `GET` | `/openapi.yaml` | Read the API definition |
| `GET` | `/block/{blockHash}` | Retrieve a Block |
| `HEAD` | `/block/{blockHash}` | Check availability |
| `POST` | `/block` | Publish a Block |
| `GET` | `/block/{blockHash}/cid` | Retrieve a CID mapping |
| `POST` | `/blocks` | Retrieve a batch |

## Development Verification

From the repository root:

```bash
pnpm run test:cli
pnpm run verify
```

The repository root `package.json` is authoritative for repository scripts.

## Related Documents

- [Protocol specification](https://alxprotocol.com/documentation/specification/)
- [Architecture overview](https://alxprotocol.com/documentation/overview/architecture-overview)
- [SDK](https://www.npmjs.com/package/@alx-protocol/sdk)
- [Retrieval API](https://alxprotocol.com/documentation/reference/rest-api)

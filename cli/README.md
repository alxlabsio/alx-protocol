# @alx-protocol/cli

Command-line interface and HTTP verification server for ALX Protocol — an open standard that gives every AI-generated artifact a deterministic identity, verifiable lineage, and traceable attribution.

## Install

```bash
npm install -g @alx-protocol/cli
```

## Quickstart

```bash
# Create a starter project with example blocks
alx init && cd alx-starter

# Validate a block's integrity
alx block verify research.block.json

# Validate an entire graph (checks for cycles, missing parents)
alx graph verify graph.json

# Inspect a block field-by-field
alx block inspect decision.block.json

# Trace attribution from a block through its lineage
alx graph trace 0xabc123... --file graph.json

# Create a three-step local chain
alx block create research.json
alx block create analysis.md --parent @last
alx block create decision.json --parent @last

# Run the official conformance test suite
alx test-vectors run
```

## Commands

```
alx init [dir] [--provider s3|ipfs|retrieval]
                              Create a starter project; optionally append storage provider env stubs
alx block show <reference>          Print a Block by hash, prefix, @last, or file
alx block verify <reference>        Validate a Block by hash, prefix, @last, or file
alx block inspect <file>             Explain a block field-by-field
alx block create <file> [--parent <reference>] [--parents <references>] [--dry-run]
                              Content: --content, --content-file, --from-ipfs, --from-s3,
                              --from-url, positional path, or stdin
                              --dry-run: compute hash only, no file writes or state changes
alx block link [<content.json>] <parent>[,...] [out.block.json] [--dry-run]
                              Parent: file path, 0x hash, @last, @latest, or @parent
                              --dry-run: compute hash only, no file writes or state changes
alx block list [--recent N|--all] [--json]
                              Recent or all indexed project Blocks
alx block types [--json]       List known advisory content types with field schemas
alx anchor create <block.json>      Anchor one validated Block
alx anchor create --hashes <h1,h2,...> [--batch-id <id>]
                              Anchor a transaction batch of Block hashes
alx anchor status <blockHash> Query on-chain anchor status
alx graph trace <hash> --file <f>    Trace attribution through a graph
alx test-vectors run           Run official conformance tests
alx conformance run            Run cross-implementation conformance suite
alx extension-conformance merkle|signing
                              Run optional extension conformance (self-test)
alx block proof <file>               Merkle inclusion proof for a block in a graph
alx test run <tests> --against <v> Run acceptance tests from sealed test Blocks
alx doctor                     Check environment: Node version, .env, IPFS, S3, retrieval server, Base/EVM
alx server start [--port 8080]        Start local HTTP verification server
alx version                    Show CLI and protocol version
```

From a git clone, use `node cli/bin/alx.js` instead of `alx` if the CLI is not installed globally.

Add `--json` to any command for machine-readable output:

```bash
# Create a block from inline content
alx block create --content '{"type":"ai.response","text":"analysis results"}' --json

# Create a block from remote content — IPFS, S3, or any URL
alx block create --from-ipfs QmYwAPJzv5CZsnA... --out ipfs-content.block.json
alx block create --from-s3 s3://my-bucket/reports/q4.pdf --out q4-report.block.json
alx block create --from-url https://example.com/data.json --out remote.block.json

# Dry-run: compute hash, print result, write nothing
alx block create --content '{"type":"ai.prompt","text":"Summarize Q4"}' --dry-run --json

# Link with positional args (content, parent, out)
alx block link ./decision-content.json research.block.json decision.block.json

# Chain using the automatically persisted last Block
alx block create ./follow-up.json --parent @last
alx block list --all

# Or flags + content file
alx block link --content-file ./decision-content.json \
  --parent research.block.json \
  --out decision.block.json \
  --append-graph graph.json

# List known advisory content types
alx block types
alx block types --json

# Check environment readiness
alx doctor

# Initialize with storage provider env stubs
alx init my-project --provider s3
alx init my-project --provider ipfs
```

## HTTP Verification Server

Start a stateless verification server. Clients verify Blocks over HTTP with no SDK dependency:

```bash
alx server start --port 8080
```

Or run with Docker:

```bash
docker build -f cli/Dockerfile -t alx-server .
docker run -p 8080:8080 alx-server
```

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check (verifies SDK is functional) |
| GET | `/version` | CLI + protocol version |
| GET | `/openapi.yaml` | OpenAPI 3.1 spec ([`openapi.yaml`](./openapi.yaml)) |
| POST | `/block/create` | Create a block from content + parents |
| POST | `/block/validate` | Validate a block's integrity |
| POST | `/trace` | Trace attribution through a graph |

### Example

```bash
# Health check
curl http://localhost:8080/health

# Create a block
curl -X POST http://localhost:8080/block/create \
  -H "Content-Type: application/json" \
  -d '{"content":{"type":"ai.response","text":"Market analysis complete"},"parentHashes":[]}'

```

### Limits

- Request body: 10 MB maximum
- Request timeout: 30 seconds
- Structured JSON logging to stdout

## Retrieval server

The verification server (`alx server start`) and the Block retrieval server (`alx retrieval start`) are separate processes on different ports. Retrieval implements [`protocol/retrieval-api.yaml`](../protocol/retrieval-api.yaml).

```bash
alx retrieval start --port 8081 --data-dir ./.alx-retrieval

# Optional hardening (reference server best practice)
export ALX_RETRIEVAL_API_KEY="team-secret"
export ALX_RETRIEVAL_RATE_LIMIT=120
alx block publish research.block.json --endpoint http://localhost:8081
```

OpenAPI spec: [`protocol/retrieval-api.yaml`](../protocol/retrieval-api.yaml) · Pages copy: `https://xandrlabs.github.io/alx-protocol/protocol/1/retrieval-api.yaml`

### Retrieval endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/openapi.yaml` | Retrieval OpenAPI spec |
| GET | `/block/{blockHash}` | Retrieve a Block |
| HEAD | `/block/{blockHash}` | Check Block existence |
| POST | `/block` | Publish a Block (also accepts `{ block, cid? }`) |
| GET | `/block/{blockHash}/cid` | IPFS CID mapping |
| POST | `/blocks` | Batch retrieve by `blockHashes` |

### Team workflow

Alice runs a shared retrieval store; Bob resolves by `blockHash` without a local CID map:

```bash
# Alice
alx retrieval start --port 8081
alx block publish research.block.json --endpoint http://alice:8081 --ipfs http://localhost:5001

# Bob
alx block resolve 0xabc... --endpoint http://alice:8081
```

This is the default team path and requires no blockchain. Public discovery belongs to the planned XNDR.network layer described in [`docs/decisions/008-storage-and-discovery-boundaries.md`](../docs/decisions/008-storage-and-discovery-boundaries.md).

### Example

```bash
curl -X POST http://localhost:8081/block \
  -H "Content-Type: application/json" \
  -d @research.block.json

curl http://localhost:8081/block/0xabc123...
```

## Monorepo layout

In the protocol repository, pnpm workspaces include `sdk` (`@alx-protocol/sdk`) and `cli` (`@alx-protocol/cli`). The root `package.json` is private and exposes `bin.alx` pointing at `cli/bin/alx.js`, so contributors can run `pnpm exec alx` or `node cli/bin/alx.js` after `pnpm build` without publishing the CLI package. Published installs use `@alx-protocol/cli` from npm.

## Documentation

- [ALX Protocol Specification](https://github.com/xandrlabs/alx-protocol/blob/main/protocol/spec.md)
- [Five-Minute Quickstart](https://github.com/xandrlabs/alx-protocol/blob/main/docs/integrators/quickstart.md)
- [SDK API Reference](https://github.com/xandrlabs/alx-protocol/blob/main/docs/integrators/api-reference.md)
- [Deployment Checklist](https://github.com/xandrlabs/alx-protocol/blob/main/docs/integrators/deployment-checklist.md)
- [Integration Adapters](https://github.com/xandrlabs/alx-protocol/blob/main/docs/integrators/adapters.md)
- [Full Documentation Index](https://github.com/xandrlabs/alx-protocol/blob/main/docs/README.md)

## License

MIT

## Related Documents

- [SDK](../sdk/README.md)
- [Protocol specification](../protocol/spec.md)

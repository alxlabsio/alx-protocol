# Changelog

All notable changes to ALX Protocol are documented in this file.

This project follows [Semantic Versioning](https://semver.org/) for SDK releases and integer versioning for the protocol specification.

## [Unreleased]

### Changed

- The Rust crate no longer packages `tests/`, which read the repository-relative `test-vectors/`, or `AGENTS.md`.
- `@alx-protocol/adapters` is marked private until it is published.
- The founding contributor is named ALX Labs throughout the repository documentation.
- Protocol documentation is published from the Docusaurus site in `site/`.
- `ALXAnchor` compiles with a pinned Solidity 0.8.28 targeting Cancun, replacing the floating `^0.8.20` pragma, and names ALX Labs as its author. The contract is not deployed, so no deployed source changes.

### Fixed

- Verification receipts report the version of the implementation that produced them. Rust reads `CARGO_PKG_VERSION`; Python reads `alx_protocol/_version.py`, which also supplies the distribution version. Both previously reported `1.0.0` in every release.
- The documentation no longer states that `ALXAnchor` verifies Merkle proofs on-chain. The contract records values; proofs are checked off-chain. The site also stated Solidity `^0.8.24`, which matched neither the old pragma nor the new pin.

### Removed

- The GitHub Pages workflow and `scripts/build-protocol-site.js`, with the `protocol:site:check` and `protocol:site:write` scripts.

## [1.0.1] — 2026-09-12

### Changed

- Published `@alx-protocol/sdk` 1.0.1 on npm, `alx-protocol` 1.0.1 on PyPI, and `alx-protocol` 1.0.1 on crates.io. The registries do not accept a reused version number; `alx-protocol` 1.0.0 remains on PyPI and is yanked on crates.io.
- Package metadata names https://alxprotocol.com as the homepage and documentation. The `repository` fields are removed until the source repository is publicly accessible.
- The SDK and CLI READMEs use absolute documentation links so they resolve on the registry pages.
- The SDK no longer lists a `settlement` keyword; the package implements no settlement helpers.

### Known Issues

- `@alx-protocol/cli` 1.0.0 on npm fails to start because it imports a module the package does not include. CLI 1.0.1 is prepared but not yet published.

## [1.0.0] — 2026-08-22

This entry prepares the first official ALX Protocol release. It becomes the public release record only when the corresponding `v1.0.0` tag and release workflow complete. Earlier numbered headings below preserve pre-release development history; those source snapshots were not tagged public releases and do not establish published compatibility commitments.

### Added

- Required raw-ingress, Graph-interaction, and Trace-boundary conformance suites covering strict serialized input, precedence interactions, depth-plus-one behavior, deterministic collections, and root failures across TypeScript, Python, and Rust.
- Mandatory TypeScript/Python/Rust differential verification for portable canonicalization, complete Blocks, canonical Graph results, Trace construction, deterministic reruns, input-order transformations, and Unicode boundaries, with a machine-readable CI evidence report.
- A single enriched `protocol/suites.json` discovery entry point and stable public commands for unit, conformance, integration, security, fuzz, schema, formatting, and repository verification.
- `sanitizeImportedParentHashes()` as an explicit TypeScript SDK import-boundary helper. It returns normalized parent hashes, rejected-entry diagnostics, duplicate diagnostics, and a `too_many_parents` collection diagnostic without changing strict Block creation.
- Local and file-backed Graph navigation through `alx graph parents`, `children`, `ancestors`, and `descendants`. Local Trace queries now use the project Block index when `--file` is omitted.

### Removed

- Redundant machine-readable rule catalogs: `protocol/canonicalization.json`, `protocol/hashing.json`, `protocol/verifier.json`, `protocol/graph-verifier.json`, `protocol/limits.json`, and `protocol/protocol.manifest.json`. Their published URLs are removed without redirects.
- Artifact-package examples, the IPFS artifact-package extension, package-verification routes, and related documentation.
- The planned `PlatformRegistry` and `CheckpointRegistry` designs and their noncanonical integration error documentation. `ALXAnchor` remains the reference contract, and generic external checkpoints remain supported.
- Demo initialization, `block link`, `block inspect`, `block proof`, `block types`, the comma-separated `--parents` option, `@latest`, `@parent`, advisory content-type warnings, and Graph-append creation side effects. Repeatable `block create --parent` is the sole local composition operation.

### Changed

- Received Blocks now require exact core fields and strict non-repairing verification across CLI files/stdin/HTTP, reference CLIs, retrieval storage, and adapters; duplicate Graph insertion fails rather than overwriting, and the remaining Rust adjacency traversal is iterative.
- The authoritative repository verification gate now includes mandatory TypeScript, Python, and Rust differential conformance.
- Verification-context extension length now follows JSON Schema Unicode code-point semantics in TypeScript, and the Rust conformance adapter now emits the required Block `protocolVersion` field.
- The Python reference implementation now implements canonical `validate_graph(seed, source, context)` with exact Graph verification envelopes, deterministic breadth-first traversal, iterative cycle detection, availability semantics, and inclusive Block/edge budgets. Its legacy adjacency form remains available.
- The TypeScript SDK now implements the canonical three-input `validateGraph(seed, source, context)` operation, including deterministic traversal, exact Graph verification envelopes, outcome precedence, missing and external parent handling, cycle detection, and Block/edge budgets. The adjacency-only overload remains deprecated for compatibility.
- The Rust reference implementation now implements canonical `validate_graph_verification(&seed, &source, &context)` with exact Graph verification envelopes, deterministic breadth-first traversal, iterative cycle detection, availability semantics, and inclusive Block/edge budgets. Its legacy adjacency helper remains available.
- Graph validation now accepts a complete seed Block, a local deterministic Block source, and a verification context. Portable vectors encode sources as order-independent finite Block collections, preserve duplicate candidates for diagnosis, and ignore unrequested source Blocks outside the reachable verification scope.
- Graph conformance now compares complete verification envelopes exactly. Canonical issues are language-neutral `{ code, blockHash }` records ordered by Block identity and code; projected results and non-normative diagnostic messages no longer satisfy Graph conformance.
- Canonical core vectors now live under top-level concern directories in `test-vectors/`; executable JavaScript tests now live under top-level `tests/`; `scripts/` remains repository tooling. Suite IDs and expected protocol outputs are unchanged.
- Graph validation now has four normative outcomes—`valid`, `invalid`, `incomplete`, and `resource_limit_reached`—with explicit precedence. Unavailable required Block data no longer establishes invalidity by itself, `checked: false` represents validation not performed, `maxDepth` bounds claim scope, and deterministic Block/edge limits are execution budgets. TypeScript, Python, and Rust cover these outcomes.
- The prerelease v1 security boundary contract now requires fail-closed Graph preparation, explicit-empty known-set semantics, Trace root membership, strict raw-JSON adapter decoding, deterministic Graph diagnostics, operational-limit separation, and non-authorization semantics for portable attestations. Valid Block identity and valid Trace outputs are unchanged.
- TypeScript, Python, and Rust Graph validation now reject malformed hashes, normalized Graph-key collisions, duplicate normalized edges, and unsupported validation modes before traversal. Explicit empty known sets now resolve no parents, omitted sets make no resolution claim, and diagnostic issues use normalized Block-hash order.
- Protocol v1 identities use the exact `ALX-CONTENT-V1\0` and `ALX-BLOCK-V1\0` domain tags before Keccak-256 hashing. All earlier pre-release canonical Block and content hashes are replaced.
- The canonical input domain is now a language-neutral ALX value model. `undefined`, sparse arrays, accessors, class instances, and other language-native containers are rejected instead of being implicitly converted.
- Portable Block attestations now sign a domain-separated digest of `algorithm`, `attester`, `blockHash`, and `timestamp`, authenticating all attestation metadata.
- Canonical Trace ordering is defined for nodes, edges, leaves, missing parents, and external parents.
- Attribution Trace `childCount` is explicitly Trace-local: it counts returned edges targeting the node and excludes children outside the reachable Trace.
- AttributionTrace is explicitly a complete computed result without protocol identity. Partial and paginated graph responses remain application query envelopes, and Trace `complete` is reserved for lineage-resolution completeness.
- Attribution Trace `pathCount` values now use exact base-10 decimal strings backed by arbitrary-precision arithmetic. The obsolete `precisionLoss` field and non-normative Trace schema size caps are removed. This is an intentional prerelease protocol v1 correction.
- Canonicalization now rejects unpaired UTF-16 surrogate code units with `ALX_CANONICALIZATION_INVALID_UNICODE`. This is an intentional prerelease protocol v1 interoperability correction.
- Graph and Trace ingestion now rejects malformed hashes, duplicate normalized parent edges, normalized key collisions, unsupported validation modes, and obsolete Trace fields before metric propagation.
- Cyclic Graphs now fail AttributionTrace construction with `ALX_GRAPH_CYCLE`; diagnostic Graph validation continues to report cycle issues.
- Serialized Blocks now require explicit `protocolVersion: "1"`; version inference from a missing field is removed while the field remains excluded from Block identity.
- Raw JSON duplicate-member handling is classified as an adapter responsibility because core canonicalization consumes ALX values. The unused `ALX_DUPLICATE_JSON_KEY` and obsolete `ALX_TRACE_CYCLE_MISMATCH` identifiers are removed.
- Signing profiles now define exact Ed25519 and P-256 encodings, prehash behavior, timestamp bounds, and P-256 low-S verification. Merkle tree construction and proof encoding now define duplicate, odd-node, and single-leaf behavior without protocol-level proof-size caps.
- TypeScript, CLI, adapter, contract, Python, and Rust packages use the final `1.0.0` release target. All three languages pass implemented core behavior, including the Graph outcome vectors, and the Merkle/signing extension suites.
- Protocol authority is consolidated in `protocol/spec.md`, `protocol/schemas/`, and `test-vectors/`; `protocol/error-codes.json` remains authoritative for exact core error identifiers.
- Protocol version `1` rejects malformed `parentHashes` collections and entries with `ALX_INVALID_HASH`. Valid-input normalization and Block hashes remain unchanged.
- Schema verification now discovers schemas from the filesystem, rejects metaschema declarations on non-schema JSON documents, and validates core and extension error registries against a shared schema.
- `protocol/chains/base-mainnet.json` now separates networks, components, contract lifecycle, deployment state, default operations, and optional operations.
- `ALXAnchor` deployment now uses independent Sepolia/mainnet records and fail-closed chain, source-tree, RPC, confirmation, signer-funding, receipt, runtime-bytecode, and post-deployment constant checks without automatically activating the integration.
- Local Block-to-CID persistence now uses an application-owned CID map instead of registry terminology.

## Pre-release development snapshot — 2026-05-31 (formerly labeled 1.2.0)

### Added
- `protocolVersion` envelope field — `"1"` added to all `createBlock` outputs across TypeScript, Python, and Rust; `validateBlock` rejects unrecognized versions with `ALX_UNSUPPORTED_VERSION`; normative Invariant 9 added to `protocol/spec.md`
- `contracts/src/ALXAnchor.sol` — permissionless existence-time anchoring for Blocks and hash batches on Base; Hardhat build, tests, deploy script, and human-readable ABI in `contracts/abis/ALXAnchor.json`
- `alx anchor` CLI command — validates Block locally then anchors `blockHash` on Base; supports single-Block and `--hashes` batch mode with deterministic `batchId` derivation
- `alx anchor status` CLI command — read-only on-chain anchor status lookup; runs without a private key
- `alx block publish` CLI command — pins a Block to IPFS through the Kubo API and records the CID in `~/.alx/cid-map.json`
- `alx block resolve` CLI command — retrieves a Block by `blockHash` from an HTTP retrieval endpoint, IPFS gateway, or the local CID map and verifies hash integrity
- `alx retrieval start` CLI command — shared Block retrieval HTTP server (`protocol/retrieval-api.yaml`); write auth via `ALX_RETRIEVAL_API_KEY`; rate limiting via `ALX_RETRIEVAL_RATE_LIMIT`
- `protocol/retrieval-api.yaml` — informative OpenAPI 3.1 spec for Block storage and retrieval; defines `GET /block/{blockHash}`, `POST /block`, `HEAD`, batch, and CID endpoints
- `cli/lib/anchor.js` — transaction helpers for ALXAnchor (`anchorBlock`, `anchorBatch`, `queryAnchor`, `deriveBatchId`)
- `cli/lib/resolve.js` — Block resolution from an HTTP retrieval endpoint, IPFS gateway, or local CID map with hash-integrity verification after every fetch
- `scripts/bench/run.js` — benchmark harness for core operations; `--json` output for CI dashboards
- `docs/benchmarks.md` — filled with measured p50/p99 numbers for all core operations on Node v20 / Windows x64
- `docs/decisions/007-threat-model-depth.md` — ADR defining in-scope threats (9 items with protocol response and residual risk) and out-of-scope threats (7 items with application-layer mitigation)
- `docs/decisions/008-storage-and-discovery-boundaries.md` — storage, discovery, and Block collection boundaries
- `docs/integrators/on-chain-base.md` — optional Base anchoring and current CLI usage
- `docs/integrators/storage.md` — storage integration guidance for IPFS, the local CID map, and the retrieval API
- conformance runner color helpers (`green`, `red`, `bold`, `dim`) centralized in `conformance/lib/impl.js`; `createRunner()` extended with `pushSuite()`/`suiteResults`; all three bin runners import from shared lib

### Changed
- `protocol/chains/base-mainnet.json` — Base network and optional ALXAnchor deployment metadata
- `pnpm-workspace.yaml` — `contracts` workspace added

### Fixed
- Verification receipts in Python and Rust — `build_receipt()` and `validate_receipt()` with full schema constraint enforcement; 22 Python tests, 8 Rust unit tests
- `docs/integrators/attributed-outputs.md` — attribution workflow guide: root Blocks, parent Blocks, `pathCount` quality signal, completeness dimension
- `docs/implementers/independent-implementation-checklist.md` — standalone conformance checklist for external implementers
- Content governance documentation: DLP boundary in `docs/trust-model.md`, `docs/governance/protocol-security-model.md`, `docs/integrators/deployment-checklist.md`, and `docs/decisions/002-content-opacity.md`
- `docs/integrators/typescript-sdk-quick-start.md` — rewritten attribution-first, strict prose style
- `docs/integrators/integration-boundaries.md` — rewritten as non-comparative Integration Boundaries document
- Python `canonical.py`: removed dead `or True` condition
- `docs/integrators/agent-integration.md`: broken `?` characters in Related Documents links
- `contracts/.gitignore` added — Hardhat `artifacts/`, `cache/`, `typechain-types/` excluded from version control

## Pre-release development snapshot — 2026-05-28 (formerly labeled 1.1.0)

### Added
- Repository restructured: `protocol/` for canonical IP, `reference-implementations/` for implementations
- TypeScript source converted from `.js` to `.ts` with exported interfaces and `strict: true`
- CLI with 8 commands: `init`, `validate`, `inspect`, `block create`, `trace`, `test-vectors run`, `serve`, `version`
- HTTP verification server (`alx server start`) with health, version, OpenAPI, Block creation, Block validation, and Trace endpoints
- Standalone conformance runner (`conformance/bin/run.js`) — 26 vectors, 3 suites
- `alx init` command creates starter projects with real blocks and a tampered block for testing
- `protocol/BLOCK.md` — explains why Blocks matter
- `protocol/VERSION` — canonical protocol version number
- `docs/VERSIONING.md` — versioning policy for protocol, test vectors, and SDKs
- `docs/EXTENSIONS.md` — storage adapter, content schema, settlement, and workflow patterns
- `docs/GRANT-REVIEW-DEMO.md` — 5-minute walkthrough for reviewers
- `docs/AUDIT-REPORT.md` — formal repository audit with grades and actionable fixes
- RFC 2119 normative keywords (MUST/SHOULD/MAY) added to `protocol/spec.md`
- `alx init` starter projects with real blocks and a tampered block for validation testing
- `adapters/README.md` with `BlockStore` interface pattern

### Changed
- `packages/sdk-typescript/` moved to `reference-implementations/typescript/`
- `implementations/python/` moved to `reference-implementations/python/`
- `implementations/rust/` moved to `reference-implementations/rust/`
- `docs/protocol/*.md` flattened into `docs/`
- `docs/implementers/*.md` flattened into `docs/`
- CI workflow updated for new directory structure
- TypeScript SDK: `js-sha3` added as dependency, `ethers` as optional peer dependency

### Removed
- `packages/xandr-app/` — application layer removed from protocol repo
- `packages/protocol/` — replaced by `reference-implementations/typescript/`
- `implementations/` directory — replaced by `reference-implementations/`
- Stale root `dist/` directory

## Initial pre-release prototype — 2025-04-15 (formerly labeled 1.0.0)

### Added
- Initial protocol specification (`protocol/spec.md`)
- JSON schemas for Block and AttributionTrace
- Canonical test vectors (canonicalization, block identity, attribution trace)
- TypeScript reference implementation (8 modules, 102+ tests)
- Python reference implementation
- Rust reference implementation
- Optional ALXAnchor contract implementation
- Protocol documentation (CORE-CONTRACT, CONFORMANCE, INVARIANTS, SECURITY, ERRORS, LINEAGE)
- Implementer guide

## Related Documents

- [Publication policy](./PUBLICATION.md)
- [Contribution guide](./CONTRIBUTING.md)

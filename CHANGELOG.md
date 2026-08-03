# Changelog

All notable changes to ALX Protocol are documented in this file.

This project follows [Semantic Versioning](https://semver.org/) for SDK releases and integer versioning for the protocol specification.

## [Unreleased]

### Added

- `sanitizeImportedParentHashes()` as an explicit TypeScript SDK import-boundary helper. It returns normalized parent hashes, rejected-entry diagnostics, duplicate diagnostics, and a `too_many_parents` collection diagnostic without changing strict Block creation.

### Removed

- Redundant machine-readable rule catalogs: `protocol/canonicalization.json`, `protocol/hashing.json`, `protocol/verifier.json`, `protocol/graph-verifier.json`, `protocol/limits.json`, and `protocol/protocol.manifest.json`. Their published URLs are removed without redirects.
- Artifact-package examples, the IPFS artifact-package extension, package-verification routes, and related documentation.

### Changed

- Protocol authority is consolidated in `protocol/spec.md`, `protocol/schemas/`, and `protocol/test-vectors/`; `protocol/error-codes.json` remains authoritative for exact core error identifiers.
- Unreleased protocol version `1` now rejects malformed `parentHashes` collections and entries with `ALX_INVALID_HASH`. Valid-input normalization and Block hashes remain unchanged.
- Schema verification now discovers schemas from the filesystem, rejects metaschema declarations on non-schema JSON documents, and validates core and extension error registries against a shared schema.
- `protocol/chains/base-mainnet.json` now separates networks, components, contract lifecycle, deployment state, default operations, and optional operations.
- Local Block-to-CID persistence now uses an application-owned CID map instead of registry terminology.

## [1.2.0] — 2026-05-31

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
- `docs/implementers/independent-implementation.md` — standalone conformance checklist for external implementers
- Content governance documentation: DLP boundary in `docs/trust-model.md`, `docs/governance/security.md`, `docs/integrators/deployment-checklist.md`, and `docs/decisions/002-content-opacity.md`
- `docs/integrators/quickstart.md` — rewritten attribution-first, strict prose style
- `docs/integrators/comparison.md` — rewritten as non-comparative Integration Boundaries document
- Python `canonical.py`: removed dead `or True` condition
- `docs/integrators/agent-integration.md`: broken `?` characters in Related Documents links
- `contracts/.gitignore` added — Hardhat `artifacts/`, `cache/`, `typechain-types/` excluded from version control

## [1.1.0] — 2026-05-28

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

## [1.0.0] — 2025-04-15

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

# Changelog

All notable changes to ALX Protocol are documented in this file.

This project follows [Semantic Versioning](https://semver.org/) for SDK releases and integer versioning for the protocol specification.

## [Unreleased]

## [1.2.0] — 2026-05-31

### Added
- `protocolVersion` envelope field — `"1"` added to all `createBlock` outputs across TypeScript, Python, and Rust; `validateBlock` rejects unrecognized versions with `ALX_UNSUPPORTED_VERSION`; normative Invariant 9 added to `protocol/spec.md`
- `contracts/ALXAnchor.sol` — permissionless existence-time registry for Blocks and blocksets on Base; Hardhat build, Foundry-compatible tests, deploy script, human-readable ABI in `contracts/abis/ALXAnchor.json`
- `alx anchor` CLI command — validates Block locally then anchors `blockHash` on Base; supports single-Block and `--blockset` mode with deterministic `setId` derivation
- `alx anchor status` CLI command — read-only on-chain anchor status lookup; runs without a private key
- `alx block publish` CLI command — pins a Block to IPFS via Kubo API and registers the CID in `~/.alx/registry.json`
- `alx block resolve` CLI command — fetches a Block by `blockHash` from Base on-chain registry, HTTP retrieval endpoint, IPFS gateway, or local registry (resolution order explicit and documented)
- `alx retrieval start` CLI command — shared Block retrieval HTTP server (`protocol/retrieval-api.yaml`); write auth via `ALX_RETRIEVAL_API_KEY`; rate limiting via `ALX_RETRIEVAL_RATE_LIMIT`
- `protocol/retrieval-api.yaml` — informative OpenAPI 3.1 spec for Block storage and retrieval; defines `GET /block/{blockHash}`, `POST /block`, `HEAD`, batch, and CID endpoints
- `cli/lib/anchor.js` — transaction helpers for ALXAnchor (`anchorBlock`, `anchorBlockSet`, `queryAnchor`, `deriveSetId`)
- `cli/lib/resolve.js` — Block resolution from IPFS gateway, HTTP endpoint, and local registry; hash integrity verification after every fetch
- `cli/lib/chain-resolve.js` — Base on-chain resolution querying ALXRegistry (CID) and ALXAnchor (timestamp) in parallel; alias relationship documented
- `scripts/bench/run.js` — benchmark harness for core operations; `--json` output for CI dashboards
- `docs/benchmarks.md` — filled with measured p50/p99 numbers for all core operations on Node v20 / Windows x64
- `docs/decisions/007-threat-model-depth.md` — ADR defining in-scope threats (9 items with protocol response and residual risk) and out-of-scope threats (7 items with application-layer mitigation)
- `docs/integrators/glossary.md` — `blockchain`, `blockset`, `alx.index`, `alx.registry`, `ALX anchor` product vocabulary
- `docs/integrators/on-chain-base.md` — ALX anchor on Base: contract map, ALXRegistry alias predecessor relationship, CLI usage for all anchor commands
- `docs/integrators/storage.md` — IPFS integration section: blockHash-vs-CID distinction, publish/resolve workflow, local registry format, pinning service table, retrieval API summary
- `maintainer/rubrics/codebase-rubric.md` — Part 11 (15 Intelligent Software Design principles) and Part 12 (15 Production HTTP API Engineering principles); `protocolVersion` added to Part 1 block field table
- Conformance runner color helpers (`green`, `red`, `bold`, `dim`) centralized in `conformance/lib/impl.js`; `createRunner()` extended with `pushSuite()`/`suiteResults`; all three bin runners import from shared lib

### Changed
- `protocol/integrations/base-mainnet.json` — `alxAnchor` contract entry added as target for new writes; `ALX_ANCHOR_ADDRESS` env override
- `pnpm-workspace.yaml` — `contracts` workspace added
- `maintainer/audit/code/scan-dead-exports.js` — `SCAN_ROOTS` extended to include `cli/bin` and `cli/src`, eliminating false positives for exports consumed by CLI shell
- `maintainer/audit/run.js` — `SCANNER_MODULES` is now the authoritative runtime registry (IDs derived via `Object.keys` rather than `manifest.scanners`)

### Fixed
- Verification receipts in Python and Rust — `build_receipt()` and `validate_receipt()` with full schema constraint enforcement; 22 Python tests, 8 Rust unit tests
- `docs/integrators/attributed-outputs.md` — attribution workflow guide: root Blocks, parent Blocks, `pathCount` quality signal, completeness dimension
- `artifact-packages/attributed-research-output/` — canonical attribution demonstration with six-block graph and multi-path `pathCount` distribution
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
- HTTP API server (`alx server start`) with endpoints for block creation, validation, tracing, and conformance
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
- Canonical artifact packages under `artifact-packages/` (see `artifact-packages/START-HERE.md`)
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
- Solidity contracts (PlatformRegistry, CheckpointRegistry) deployed on Base mainnet
- Protocol documentation (CORE-CONTRACT, CONFORMANCE, INVARIANTS, SECURITY, ERRORS, LINEAGE)
- Implementer guide

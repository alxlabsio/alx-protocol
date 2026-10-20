# ALX Protocol

ALX Protocol defines deterministic, content-addressed `Block` identity and local verification of declared parent lineage.

A `Block` binds opaque, application-defined `content` and normalized `parentHashes` into two deterministic identities: `contentHash` and `blockHash`.

This repository contains the canonical protocol sources, language-neutral conformance materials, TypeScript SDK, Python and Rust implementations, CLI and server tooling, optional extensions and contracts, and public documentation.

## Status

* **Current protocol version:** `1` ([`protocol/VERSION`](protocol/VERSION))
* **Published packages:** `@alx-protocol/sdk` 1.0.1 on npm, `alx-protocol` 1.0.1 on PyPI, and `alx-protocol` 1.0.1 on crates.io. The CLI 1.0.1 and the adapters package are not yet published, and the `v1.0.1` repository tag is pending.
* **Documentation:** [alxprotocol.com/documentation](https://alxprotocol.com/documentation/)
* **Review status:** The repository is open for public review. Independent protocol and contract review is pending. See [Security Review Status](docs/governance/security-review-status.md).

Protocol authority and implementation maturity are separate:

* **Canonical:** [`protocol/spec.md`](protocol/spec.md), [`protocol/schemas/`](protocol/schemas/), [`test-vectors/`](test-vectors/), and [`protocol/error-codes.json`](protocol/error-codes.json)
* **Reference:** Maintained implementations and conformance runners provide interoperability evidence but do not define protocol behavior.
* **Guide:** Root topic maps and files under [`docs/`](docs/) explain the canonical sources without adding requirements.

If an implementation or explanatory document conflicts with a canonical source, **the canonical source governs**.

## What is ALX?

`Block` is the sole ALX Protocol primitive.

Each Block contains:

* `content` — an opaque ALX value whose application meaning is outside the protocol
* `parentHashes` — identities of direct parent Blocks, normalized before entering `blockHash` derivation
* `contentHash` — deterministic content identity
* `blockHash` — deterministic Block identity

ALX defines:

* deterministic canonicalization
* domain-separated Block and content identity
* individual Block validation
* scoped Graph verification
* Trace construction

Graph verification is local to a supplied seed, deterministic Block source, and verification context. Verification distinguishes among `invalid`, `incomplete`, and `resource_limit_reached` results rather than treating missing data or exhausted resources as protocol violations.

A Trace can describe reachable structure, including exact `pathCount` values.

### What ALX does not define

ALX does **not** define a:

* blockchain
* consensus network
* database
* storage system
* transport
* indexer
* explorer
* application
* content schema
* actor identity
* settlement policy

Applications may provide any of these capabilities without making them part of ALX Core.

## Quick Start

Install the implementation for your language:

```bash
npm install @alx-protocol/sdk   # JavaScript and TypeScript, Node.js 20 or later
pip install alx-protocol        # Python 3.11 or later
cargo add alx-protocol          # Rust
```

Each package creates, validates, and traces Blocks from the same protocol rules and passes the same conformance vectors, so a Block created with one verifies with the others.

### Try the CLI

The CLI is the fastest way to become familiar with ALX. From a repository checkout:

```bash
pnpm install --frozen-lockfile
pnpm run build

node cli/bin/alx.js block create --content '{"type":"source","text":"Initial research"}'
node cli/bin/alx.js block create --content '{"type":"analysis","text":"Derived finding"}' --parent @last
node cli/bin/alx.js block verify @last
node cli/bin/alx.js graph parents @last
node cli/bin/alx.js graph trace @last
```

The first command creates a root Block. The second creates a derived Block whose `parentHashes` contains the root's `blockHash`. `@last` is a local CLI selector; the stored Block contains the resolved immutable hash.

The CLI stores these Blocks in the nearest `.alx/` project directory. Use `node cli/bin/alx.js block list --all` to inspect that local index. See the [CLI guide](cli/README.md) for file inputs, dry runs, Graph traversal, retrieval, and conformance commands.

Once `@alx-protocol/cli` 1.0.1 is published, `npm install -g @alx-protocol/cli` provides the shorter `alx` command in place of `node cli/bin/alx.js`. Version 1.0.0 on npm fails to start and should not be used.

### Build With The SDK

Applications embed ALX through the TypeScript SDK. Follow the [SDK Quick Start](docs/quick-start.md) after trying the CLI, then use the [SDK guide](sdk/README.md#quickstart) and [canonical Graph verification API](sdk/README.md#canonical-graph-verification) for application integration.

Before implementing ALX in another language, read the [canonical specification](protocol/spec.md), [Canonicalization](CANONICALIZATION.md), [Identity](IDENTITY.md), [Graph and Trace](GRAPH.md), and [Conformance](CONFORMANCE.md).

## Specification and Technical Reference

| Resource                                      | Purpose                                           |
| --------------------------------------------- | ------------------------------------------------- |
| [Canonical specification](protocol/spec.md)   | Normative processing rules and protocol semantics |
| [Specification map](SPECIFICATION.md)         | Protocol authority and topic navigation           |
| [Canonicalization](CANONICALIZATION.md)       | ALX value and serialized-input boundary           |
| [Block and content identity](IDENTITY.md)     | `contentHash`, `blockHash`, and `parentHashes`    |
| [Graph and Trace](GRAPH.md)                   | Lineage, verification outcomes, scope, and Trace  |
| [Glossary](GLOSSARY.md)                       | Canonical terminology index                       |
| [Conformance](CONFORMANCE.md)                 | Conformance suite and claim model                 |
| [Optional Extensions](EXTENSIONS.md)          | Capabilities separate from ALX Core               |
| [Protocol architecture](docs/architecture.md) | Explanatory protocol layer model                  |
| [Security and trust boundaries](SECURITY.md)  | Security guidance and reporting entry point       |

## Implementations

ALX maintains three implementations for cross-language interoperability.

| Language | Location | Package | Repository role |
| --- | --- | --- | --- |
| TypeScript / JavaScript | [`sdk/`](sdk/) | [`@alx-protocol/sdk`](https://www.npmjs.com/package/@alx-protocol/sdk) on npm | Primary developer SDK and maintained conformance implementation |
| Python | [`reference-implementations/python/`](reference-implementations/python/) | [`alx-protocol`](https://pypi.org/project/alx-protocol/) on PyPI | Maintained peer implementation |
| Rust | [`reference-implementations/rust/`](reference-implementations/rust/) | [`alx-protocol`](https://crates.io/crates/alx-protocol) on crates.io | Maintained peer implementation |

The repository's differential gate compares all three maintained implementations.

See [Cross-Language Parity](reference-implementations/PARITY.md) for current capability coverage.

## Conformance

Independent implementations discover required Core suites through [`protocol/suites.json`](protocol/suites.json), execute the language-neutral [`test-vectors/`](test-vectors/), and compare complete results according to the declared suite mode.

Native tests cover cases that cannot be transported through the JSON adapter interface.

Start here:

* [Conformance model](CONFORMANCE.md)
* [Runner and adapter interface](conformance/README.md)
* [Suite manifest](protocol/suites.json)
* [Canonical test vectors](test-vectors/README.md)
* [Schema fixtures](protocol/fixtures/)
* [Independent implementation guide](docs/implementation-guide.md)

From the repository root:

```bash
pnpm install --frozen-lockfile
pnpm run verify:protocol
pnpm run verify:cross-language
```

For the complete repository verification gate:

```bash
pnpm run verify
```

Root [`package.json`](package.json) scripts are authoritative if command names change.

## Developer Resources

* [TypeScript SDK](sdk/README.md)
* [CLI and HTTP tooling](cli/README.md)
* [Storage adapters](adapters/README.md)
* [Documentation hub](docs/README.md)
* [TypeScript SDK quick start](docs/integrators/typescript-sdk-quick-start.md)
* [SDK API reference](docs/integrators/api-reference.md)
* [Executable tests](tests/README.md)
* [Reference implementations](reference-implementations/README.md)

## Extensions

Extensions provide optional capabilities with rules and conformance requirements separate from ALX Core.

Current extension areas include:

* content profiles
* Merkle proofs
* signing and attestations

Extension specifications live under [`protocol/extensions/`](protocol/extensions/).

Supporting contracts and blockchain anchoring under [`contracts/`](contracts/) are optional integrations. They do **not** alter Block identity or Core conformance.

See [Optional Extensions](EXTENSIONS.md) for extension boundaries and discovery paths.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for:

* development setup
* change classification
* protocol authority
* testing requirements
* review requirements

Protocol-visible changes must update the applicable canonical sources and pass full cross-language conformance.

## License

ALX Protocol is available under the [MIT License](LICENSE).

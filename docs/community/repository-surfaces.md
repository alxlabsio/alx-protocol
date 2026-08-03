# ALX Repository Surfaces

The document maps the current ALX Protocol repository surfaces available for local review, integration, and implementation. The repository includes reference implementations, developer tooling, and optional extension surfaces.

Reviewers, implementers, and integrators can use the document to quickly locate working ALX Protocol surfaces across the repository. Protocol behavior, conformance requirements, and core Block validity remain defined by the normative protocol documents.

---

## Reference Implementations

| Project | Language | Status | Description |
|---|---:|---|---|
| [`@alx-protocol/sdk`](../../sdk/) | TypeScript | Primary TypeScript SDK | Primary TypeScript implementation for creating Blocks, validating structure, tracing lineage, verifying artifacts, and using optional signing or Merkle extension helpers |
| [`alx_protocol`](../../reference-implementations/python/) | Python | Reference implementation | Python implementation designed for AI, data, research, and automation workflows, with conformance adapter support for cross-language validation |
| [`alx-protocol`](../../reference-implementations/rust/) | Rust | Reference implementation | Rust implementation focused on deterministic Block handling, portable validation behavior, and conformance adapter support |

## Tooling

| Project | Description |
|---|---|
| [`@alx-protocol/cli`](../../cli/) | Command-line interface for creating, validating, inspecting, tracing, retrieving, anchoring, and testing ALX Blocks |
| [`ALX HTTP Server`](../../cli/server/server.js) | Local JSON API server that exposes Block operations for developer integrations, product prototypes, and service-oriented testing |
| [`conformance Runner`](../../conformance/) | Test harness that checks implementations against canonical ALX test vectors and expected protocol behavior |

## Optional Extensions

| Extension | Description |
|---|---|
| [`content-profile`](../../protocol/extensions/content-profile/) | Optional typed structure inside `Block.content` while opaque content remains valid |
| [`signing`](../../protocol/extensions/signing/) | Optional attestation layer for signing Blocks while preserving stable core Block identity |
| [`merkle`](../../protocol/extensions/merkle/) | Optional checkpoint and inclusion-proof surface for batch verification, audit trails, and integrity proofs |

---

## Add A Project

Teams using ALX Protocol in production, research, education, infrastructure, or experimental work may register a project so reviewers, builders, and future integrators can discover active ALX Protocol usage.

1. Fork the repository.
2. Add the project to the appropriate table above.
3. Submit a pull request.

Include the project name, link, language or platform, brief description, and conformance status where available.

---

## Related Documents

- [`../integrators/quickstart.md`](../integrators/quickstart.md) — fastest path to using ALX Protocol in an application
- [`../integrators/agent-frameworks.md`](../integrators/agent-frameworks.md) — examples for connecting ALX Protocol to agent frameworks
- [`../../CONTRIBUTING.md`](../../CONTRIBUTING.md) — contribution rules, review process, and project expectations

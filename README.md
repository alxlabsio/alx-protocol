<h1 align="center">ALX Protocol</h1><p align="center">The protocol for intelligent systems.</p><p align="center">
</p><p align="center">
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT">
  </a>
</p>

# What is ALX?

ALX Protocol defines deterministic identity and verifiable relationships for data produced by intelligent systems. AI agents and applications represent prompts, outputs, decisions, tool responses, workflow steps, and other digital artifacts as portable ALX Blocks.

Each Block can declare other Blocks as direct parents through parentHashes. These relationships form Block Graphs, allowing applications to inspect, validate, and traverse declared lineage independently of the originating system.

Blocks can represent source documents, prompts, model responses, datasets, analyses, reviews, decisions, workflow states, tool results, and agent handoffs.

## Block Structure

Each Block contains five fields:

- `content` . JSON-serializable artifact data
- `parentHashes` . declared parent Block references
- `contentHash` . deterministic identity of the Block content
- `blockHash` . deterministic identity of the Block content and declared parent relationships

ALX uses deterministic hashing to establish Block identity. Changes to content change contentHash and blockHash. Changes to parentHashes change blockHash. Equivalent protocol inputs produce identical hashes across conforming implementations.

Applications can independently recompute Block hashes and validate Block structure. When parent Blocks are available, applications can also traverse and validate declared relationships.

ALX supports local Block creation and validation without a blockchain, token, hosted service, storage provider, or vendor API.

Protocol validation confirms deterministic identity, Block structure, and declared relationships. Validation does not establish factual accuracy, creator identity, ownership, or the completeness of real-world dependencies.

## Documentation

- [Whitepaper](docs/whitepaper.md)
- [Getting Started](docs/integrators/quickstart.md)
- [Protocol Specification](protocol/spec.md)
- [API Reference](docs/integrators/api-reference.md)
- [Trust Model](docs/trust-model.md)
- [CLI](cli/README.md)

## License

MIT © ALX Foundation

<h1 align="center">ALX Protocol</h1><p align="center">The protocol for intelligent systems.</p><p align="center">
</p><p align="center">
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT">
  </a>
</p>

# What is ALX?

**ALX Protocol is a protocol for intelligent systems.** AI agents and applications record prompts, outputs, decisions, tool responses, workflow steps, and other digital work as portable **ALX Blocks**.

Blocks can declare earlier Blocks as direct inputs. These parent relationships connect Blocks into **Block Graphs**, creating machine-readable lineage that AI agents and applications can navigate, validate, and build on.

An ALX Block can represent a source document, prompt, model response, dataset, analysis, review, decision, workflow state, tool response, agent handoff, or other JSON-compatible artifact.

## Block Structure

Each Block contains:

- `content` . JSON-serializable artifact data
- `parentHashes` . declared parent Block references
- `contentHash` . deterministic identity of the Block content
- `blockHash` . deterministic identity of the Block content and declared parent relationships

ALX identity is deterministic. Changing the content changes the Block identity. Changing the declared parents changes the `blockHash`. When the content and parent relationships remain unchanged, every conforming implementation produces the same hashes.

Anyone with the required Block data can recompute the hashes locally and validate Block identity. When declared parent Blocks are available, applications can follow the parent relationships and validate declared lineage.

ALX does not require a blockchain, token, hosted service, storage provider, or vendor API for Block creation or local validation.

Block validation confirms deterministic identity, structure, and declared relationships. Block validation does not prove that Block content is true, identify the Block creator, or establish ownership.

## Documentation

- [Whitepaper](docs/whitepaper.md)
- [Getting Started](docs/integrators/quickstart.md)
- [Protocol Specification](protocol/spec.md)
- [API Reference](docs/integrators/api-reference.md)
- [Trust Model](docs/trust-model.md)
- [CLI](cli/README.md)

## License

MIT © ALX Foundation

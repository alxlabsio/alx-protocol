# Block and Content Identity

Status: public topic map; normative rules remain in the canonical sources

ALX distinguishes content identity from complete Block identity. The exact
domain tags, hash inputs, normalization rules, and digest encoding are defined
in [`protocol/spec.md`, sections 1 and 3](./protocol/spec.md#1-primitive).

## Identity map

| Name | Identifies | Primary source |
|---|---|---|
| `contentHash` | Canonicalized Block `content` | [`protocol/spec.md`, section 3](./protocol/spec.md#3-identity) |
| `blockHash` | Canonicalized `content` together with normalized `parentHashes` | [`protocol/spec.md`, section 3](./protocol/spec.md#3-identity) |
| `parentHashes` | Declared direct parent Block identities | [`protocol/spec.md`, Parent Hash Normalization](./protocol/spec.md#parent-hash-normalization) |
| `protocolVersion` | The protocol rules used to interpret a Block | [`protocol/spec.md`, section 1](./protocol/spec.md#1-primitive) |

## Canonical sources

- [`protocol/schemas/block.schema.json`](./protocol/schemas/block.schema.json)
  defines the complete v1 Block shape.
- [`test-vectors/identity/`](./test-vectors/identity/) and the applicable Block
  suites freeze identity outputs and validation cases.
- [`protocol/error-codes.json`](./protocol/error-codes.json) defines exact core
  error identifiers.

## Boundary

Actor identity, signatures, attestations, storage addresses, timestamps,
network observations, and blockchain commitments do not enter core
`contentHash` or `blockHash`. Optional extensions may bind evidence to a Block
without redefining its core identity.

## Related documents

- [`CANONICALIZATION.md`](./CANONICALIZATION.md)
- [`GRAPH.md`](./GRAPH.md)
- [`EXTENSIONS.md`](./EXTENSIONS.md)

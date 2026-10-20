# ALX Versioning Policy

**Document type:** Operational

This policy separates protocol, package, extension, contract, and application versions. It does not define protocol behavior.

## Protocol version

The current protocol version is declared by [`../../protocol/VERSION`](../../protocol/VERSION). Every v1 Block includes `protocolVersion: "1"`; the version field is excluded from the v1 `contentHash` and `blockHash` preimages.

A protocol version change is required when a released canonical change would alter existing behavior, including:

- canonical bytes for an accepted value;
- identity hash inputs, domains, algorithm, or output;
- Block structural validity;
- parent normalization or Graph outcome meanings;
- Trace construction or exact result shape;
- canonical error identifiers for existing failures; or
- an existing required vector's expected result.

Adding a required operation or field can also be breaking even when existing outputs are unchanged because conforming implementations would no longer satisfy the complete claim.

Editorial clarification, new explanatory documentation, implementation optimization, and additional non-conflicting coverage do not by themselves require a protocol version change.

## Canonical artifact versioning

Schemas, vectors, the suite manifest, and error registries are part of the versioned protocol release. Changes must remain mutually aligned.

New vectors within v1 may clarify or cover already-defined behavior. They must not silently introduce a new requirement or change an existing expected result. Test-vector format changes follow [`../../test-vectors/FORMAT.md`](../../test-vectors/FORMAT.md) and its changelog.

## Package versions

SDKs, CLI tools, adapters, runners, and reference implementations use their own package or crate versions. A package version does not select protocol behavior unless the implementation explicitly declares the protocol version it supports.

Package-only API changes follow the package's compatibility policy and changelog. A package may add helpers without changing protocol version when those helpers preserve canonical behavior and are not added to the core conformance claim.

## Extension versions

Each optional extension declares `extensionVersion`, lifecycle, compatible protocol versions, deprecation, and supersession metadata in its manifest. Extension changes do not change core protocol version unless they alter core requirements—which an optional extension is not permitted to do.

## Contract and deployment versions

A contract source version and a deployed network/address identify external integration artifacts. They are not ALX protocol versions. Record source commit, compiler, constructor/configuration, network, address, and review status for each deployment.

## Application versions

Applications independently version content profiles, database schemas, indexes, API envelopes, and Explorer behavior. Those migrations preserve the complete canonical Block and must not reinterpret application metadata as protocol fields.

## Future versions

V1 does not define cross-version Graph semantics. A future protocol version must specify whether and how Blocks from different versions can be examined together. Verifiers reject unsupported `protocolVersion` values rather than guessing.

## Release process

A version declaration or changelog entry does not by itself create a public release. [`../../PUBLICATION.md`](../../PUBLICATION.md) defines how tagged releases establish the public record.

## Related documents

- [`../../VERSIONING.md`](../../VERSIONING.md) — concise public versioning entry point
- [`stability.md`](./stability.md) — stability dimensions and lifecycle terms
- [`migration.md`](./migration.md) — upgrade guidance
- [`evolution-and-graph-completeness.md`](./evolution-and-graph-completeness.md) — frozen v1 boundaries
- [`protocol-change-process.md`](./protocol-change-process.md) — change process

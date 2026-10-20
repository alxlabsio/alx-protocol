# Upgrade and Migration Guide

**Document type:** Guide

This guide separates package upgrades that preserve ALX v1 behavior from future protocol-version migrations. It does not define a future protocol version.

## Identify the version being changed

Record each independently:

- ALX protocol version from [`../../protocol/VERSION`](../../protocol/VERSION);
- SDK, CLI, adapter, or reference-implementation package version;
- extension version from its `extension.json`;
- contract source and deployment identity; and
- application schema and database migration version.

A package version does not redefine a Block's `protocolVersion`.

## Same-protocol package upgrade

Before upgrading a package that still implements protocol version `1`:

1. read [`../../CHANGELOG.md`](../../CHANGELOG.md) and package notes;
2. install from the frozen lockfile or resolved package manifest;
3. run the affected native tests and required conformance suites;
4. verify representative stored Blocks and Graph contexts;
5. compare deterministic outputs before and after the upgrade; and
6. document any local resource-limit or API changes.

Existing v1 Blocks require no rehashing when canonical v1 behavior is preserved. A package API migration may still be necessary even when protocol data is unchanged.

## Current Graph API migration

New Graph verification code uses:

```text
validateGraph(seed, source, context)
```

The older adjacency-only `validateGraph(graph, context?)` form remains a TypeScript compatibility overload and returns a different result model. Migrate callers by supplying the root Block separately, using an explicit Block source, recording a Verification Context, and handling all four canonical statuses.

Do not translate missing required parents into `invalid`. Do not treat `checked: false` as a validation status.

## Future protocol-version migration

A future protocol release must publish its own migration rules. Until then, do not assume:

- that v1 and future Blocks can share a Graph verification request;
- that a future Block may reference a v1 `blockHash` with defined semantics;
- that hash or canonicalization changes permit identity preservation;
- that adding a field is automatically backward compatible; or
- that a package major version implies a protocol major version.

Every v1 Block declares `protocolVersion: "1"`. Verifiers reject unsupported versions. Future cross-version behavior requires explicit canonical rules rather than storage-layer inference.

## Application and storage migration

Storage rows, reverse child indexes, observation metadata, API envelopes, and Explorer views are application data. Applications may migrate those structures without changing stored Blocks, provided the complete canonical Block values remain intact.

Recommended application migration controls:

- back up persistent data;
- validate Blocks before and after transformation;
- make index rebuilds reproducible from canonical Blocks;
- record index revision and source scope;
- preserve unknown application content without interpreting it as protocol metadata; and
- roll back package/configuration changes without rewriting canonical Blocks.

## Extensions and contracts

Follow each extension manifest's compatibility and supersession metadata. Adding or removing an attestation or proof does not alter core Block identity.

Contract upgrades and deployments are external integration events. Record network, address, source commit, compiler, constructor/configuration, and independent-review status separately from protocol version.

## Release evidence

For a migration release, preserve:

- before/after package and protocol versions;
- the exact canonical suite manifest tested;
- deterministic comparison results;
- database/index migration logs;
- rollback steps; and
- remaining compatibility limitations.

## Related documents

- [`versioning.md`](./versioning.md) — version policy
- [`stability.md`](./stability.md) — lifecycle and compatibility terms
- [`evolution-and-graph-completeness.md`](./evolution-and-graph-completeness.md) — frozen v1 evolution boundaries
- [`../implementers/implementation-compatibility-matrix.md`](../implementers/implementation-compatibility-matrix.md) — maintained implementation parity

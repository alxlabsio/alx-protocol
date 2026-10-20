# Versioning

Status: public versioning entry point; policy remains in the governing sources

ALX distinguishes protocol versions from SDK, CLI, reference implementation,
extension, and contract versions.

## Governing sources

| Source | Responsibility |
|---|---|
| [`protocol/VERSION`](./protocol/VERSION) | Current protocol version declaration |
| [`docs/governance/versioning.md`](./docs/governance/versioning.md) | Compatibility and breaking-change policy |
| [`docs/governance/stability.md`](./docs/governance/stability.md) | Stability and deprecation policy |
| [`GOVERNANCE.md`](./GOVERNANCE.md) | Decision authority and change process |
| [`CHANGELOG.md`](./CHANGELOG.md) | Repository revision history |
| [`PUBLICATION.md`](./PUBLICATION.md) | Release and publication lifecycle |

Package versions do not implicitly change the protocol version. A protocol
change that alters canonicalization, identity derivation, Block or Graph
validity, Trace output, canonical errors, schema acceptance, or existing
canonical outputs requires the applicable governance and version assessment.

## Related documents

- [`SPECIFICATION.md`](./SPECIFICATION.md)
- [`CONFORMANCE.md`](./CONFORMANCE.md)
- [`EXTENSIONS.md`](./EXTENSIONS.md)

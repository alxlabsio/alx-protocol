# ALX Protocol Extensions

**Status:** Extension index  
**Audience:** Implementers, integrators  
**Authority:** Discovery index for optional extensions. Does not alter core protocol conformance.

## Purpose

This directory contains optional protocol extensions. Extensions may define their own behavior, vectors, manifests, and conformance suites, but they do not change what is required for core ALX conformance.

Extension manifests declare independent lifecycle and compatibility metadata, including extension version, lifecycle state, compatible protocol versions, and whether the extension is deprecated or supersedes another extension version. See [`../../docs/governance/evolution-and-graph-completeness.md`](../../docs/governance/evolution-and-graph-completeness.md).

## Extension index

| Extension | Purpose | Manifest | Runner |
|---|---|---|---|
| [`merkle/`](./merkle/) | checkpoint inclusion proofs | [`merkle/extension.json`](./merkle/extension.json) | `alx extension-conformance merkle` |
| [`signing/`](./signing/) | signed Block attestations | [`signing/extension.json`](./signing/extension.json) | `alx extension-conformance signing` |
| [`ipfs-artifact-package/`](./ipfs-artifact-package/) | IPFS CID package manifest (schema-only) | [`ipfs-artifact-package/extension.json`](./ipfs-artifact-package/extension.json) | schema validation + fixtures |

Machine-readable suite discovery begins at [`../suites.json`](../suites.json).

## Related Documents

- [`../spec.md`](../spec.md)
- [`../../docs/governance/evolution-and-graph-completeness.md`](../../docs/governance/evolution-and-graph-completeness.md)

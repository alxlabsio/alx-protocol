# Stability Policy

**Document type:** Operational

This page defines how stability labels are used across protocol, package, extension, and deployment surfaces. It does not change canonical protocol behavior.

## Separate stability dimensions

| Surface | Version/lifecycle source | Meaning |
|---|---|---|
| Protocol | [`../../protocol/VERSION`](../../protocol/VERSION), tagged releases | Canonical behavior and data compatibility |
| Package/API | Package manifest and changelog | Source/binary API compatibility for that implementation |
| Extension | `extension.json` lifecycle and version | Compatibility for an optional extension claim |
| Contract | Source commit, network, and deployed address | Identity of one external deployment |
| Application schema | Application-owned migration record | Product data and query compatibility |

Never infer one dimension from another. SDK `1.x` does not by itself prove a tagged ALX protocol v1 release, and an extension lifecycle does not change core status.

## Protocol compatibility

A v1-compatible change preserves all existing canonical v1 behavior, including:

- canonical bytes for every accepted value;
- `contentHash` and `blockHash` outputs;
- existing valid/invalid classifications and Graph outcome meanings;
- canonical structure and error identifiers; and
- applicable required expected results.

A change to those properties is breaking unless repository governance determines that unreleased canonical sources contain an internal inconsistency that must be repaired together.

## Current repository status

The maintained packages are versioned for the `1.0.0` release target, while [`../../PUBLICATION.md`](../../PUBLICATION.md) records whether a tagged public protocol release exists. Do not describe v1 as publicly released, independently audited, or permanently frozen until the corresponding publication and security-review records support those claims.

Core operation membership is discovered from [`../../protocol/suites.json`](../../protocol/suites.json), not from a manually maintained stability table.

## Extension lifecycle

Extension lifecycle values and compatibility fields are defined by [`../../protocol/schemas/extension-manifest.schema.json`](../../protocol/schemas/extension-manifest.schema.json). An extension may be provisional, stable, deprecated, or otherwise classified by the allowed schema without becoming part of core conformance.

## Package API deprecation

Package maintainers should:

1. identify the deprecated symbol and supported replacement;
2. document protocol-visible versus API-only impact;
3. provide a reasonable prerelease or release transition appropriate to published compatibility commitments;
4. add migration tests or examples; and
5. remove the symbol only in a package release that permits that API break.

Do not promise an absolute grace period that has not been adopted by governance. A compatibility helper may remain exported even though new documentation uses the canonical API.

## Stability claims

Words such as stable, final, immutable, permanent, guaranteed, and audited require a named surface and supporting lifecycle record. Prefer precise claims such as “the same v1 hash inputs produce the same canonical output” or “extension lifecycle is `provisional` in its manifest.”

## Related documents

- [`versioning.md`](./versioning.md) — version and breaking-change policy
- [`migration.md`](./migration.md) — upgrade guidance
- [`evolution-and-graph-completeness.md`](./evolution-and-graph-completeness.md) — frozen v1 boundaries
- [`../../PUBLICATION.md`](../../PUBLICATION.md) — public release status
- [`security-review-status.md`](./security-review-status.md) — independent-review status

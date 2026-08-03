# Publication Status

**Status:** Repository publication policy
**Audience:** Maintainers, reviewers, and adopters
**Authority:** Records publication identity and lifecycle state; canonical protocol sources govern protocol behavior
**Last reviewed:** 2026-08-01

This document identifies the current publication authority and lifecycle status of ALX Protocol materials. It does not define protocol behavior.

---

## Current Status

ALX Protocol version 1 is an open protocol maintained by ALX Foundation. The source repository at [github.com/xandrlabs/alx-protocol](https://github.com/xandrlabs/alx-protocol) is the current publication surface for the specification, schemas, canonical conformance materials, governance documents, and release history.

The repository is founder-led and open for public review. A version number or changelog entry identifies source state; it does not by itself establish a tagged public release. Tagged releases and their archived source bundles are the release records once created through the repository release workflow.

## Publication Identity

| Field | Current value |
|---|---|
| Protocol steward and publisher | ALX Foundation, an independent nonprofit |
| Founding contributor | Xandr Labs |
| Source repository | `https://github.com/xandrlabs/alx-protocol` |
| Protocol version | `1`, from [`protocol/VERSION`](./protocol/VERSION) |
| Normative authority | [`protocol/spec.md`](./protocol/spec.md), [schemas](./protocol/schemas/), [test vectors](./protocol/test-vectors/), and the exact identifiers in [`protocol/error-codes.json`](./protocol/error-codes.json) |
| License | MIT; see [`LICENSE`](./LICENSE) |
| Versioning policy | [`docs/governance/versioning.md`](./docs/governance/versioning.md) |
| Revision history | [`CHANGELOG.md`](./CHANGELOG.md) and tagged repository releases |
| Archive location | Tagged releases in the source repository |

## Documentation Domains

`alx.pro/docs` and `alx.foundation/docs` are intended documentation locations. They are not identified as canonical public endpoints until their hosting, redirects, and publication controls are active and ALX Foundation announces the canonical URL. Until then, repository-relative links are authoritative and documentation must not imply that either domain is live.

The existing GitHub Pages schema identifiers remain protocol identifiers and publication paths for version 1. A future domain migration must preserve stable identifiers or provide permanent redirects before those identifiers change.

## Organizational Boundary

ALX Foundation maintains the open protocol and its canonical conformance materials independently of any commercial product, application, service, or economic mechanism. Xandr Labs is the founding contributor and develops implementations, tooling, applications, services, and supporting infrastructure for the ALX ecosystem. Xandr Labs does not determine protocol conformance through its commercial products or ecosystem services.

DOCX files and other generated publication derivatives are non-canonical. They must be regenerated from reviewed source documents and must not replace the repository sources as protocol authority.

---

## Related Documents

- [`GOVERNANCE.md`](./GOVERNANCE.md) — stewardship and decision authority
- [`MAINTAINERS.md`](./MAINTAINERS.md) — current responsibilities and contacts
- [`protocol/README.md`](./protocol/README.md) — normative artifact hierarchy
- [`docs/governance/versioning.md`](./docs/governance/versioning.md) — versioning rules
- [`CHANGELOG.md`](./CHANGELOG.md) — revision history

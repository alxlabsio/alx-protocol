# Publication Status

This document records the publication authority, canonical sources, and lifecycle status of ALX Protocol materials. It does not define protocol behavior.

---

## Publication Authority

ALX Protocol version 1 is an open protocol maintained and published by ALX Foundation.

The source repository for the specification, schemas, canonical conformance materials, governance documents, and release history is not yet publicly accessible. Until it is, the protocol is distributed through its published packages and documented at [alxprotocol.com](https://alxprotocol.com/documentation/).

| Field                          | Current value                                                      |
| ------------------------------ | ------------------------------------------------------------------ |
| Protocol steward and publisher | ALX Foundation, an independent nonprofit                           |
| Founding contributor           | ALX Labs                                                        |
| Source repository              | Not yet publicly accessible |
| Published packages             | [`@alx-protocol/sdk`](https://www.npmjs.com/package/@alx-protocol/sdk) on npm; [`alx-protocol`](https://pypi.org/project/alx-protocol/) on PyPI; [`alx-protocol`](https://crates.io/crates/alx-protocol) on crates.io |
| Documentation                  | [alxprotocol.com/documentation](https://alxprotocol.com/documentation/) |
| Protocol version               | `1`, from [`protocol/VERSION`](./protocol/VERSION)                 |
| License                        | MIT; see [`LICENSE`](./LICENSE)                                    |
| Versioning policy              | [`docs/governance/versioning.md`](./docs/governance/versioning.md) |
| Revision history               | [`CHANGELOG.md`](./CHANGELOG.md) and tagged repository releases    |
| Archive location               | Tagged releases in the source repository                           |

## Canonical Sources

Protocol behavior is governed by the canonical protocol artifacts:

* [`protocol/spec.md`](./protocol/spec.md)
* [`protocol/schemas/`](./protocol/schemas/)
* [`test-vectors/`](./test-vectors/)
* the exact identifiers in [`protocol/error-codes.json`](./protocol/error-codes.json)

`PUBLICATION.md` records publication status and does not supersede these sources.

For the complete normative artifact hierarchy, see [`protocol/README.md`](./protocol/README.md).

## Release Status

The repository is founder-led and open for public review.

The published packages are `@alx-protocol/sdk` 1.0.1 on npm and `alx-protocol` 1.0.1 on PyPI and crates.io. The CLI 1.0.1 and the adapters package are not yet published, and the `v1.0.1` repository tag is pending; a package publication does not by itself establish the tagged public release record described below.

A version number or [`CHANGELOG.md`](./CHANGELOG.md) entry identifies source state; it does not by itself establish a tagged public release.

A tagged release created through the repository release workflow establishes the public release record. Its associated archived source represents the source state published for that release.

Release and versioning rules are defined in [`docs/governance/versioning.md`](./docs/governance/versioning.md).

## Documentation Domains

The protocol documentation is published at [alxprotocol.com/documentation](https://alxprotocol.com/documentation/) from the `site/` directory. `alx.pro/docs` and `alx.foundation/docs` are not canonical public endpoints until their hosting, redirects, and publication controls are active and ALX Foundation announces the canonical URL.

Until then:

* repository-relative links are authoritative;
* documentation must not imply that either domain is live or canonical.

Existing GitHub Pages schema identifiers remain protocol identifiers for version 1. They are not currently served; the canonical copies are the files under [`protocol/`](./protocol/).

Any future domain migration must preserve stable identifiers or provide permanent redirects before those identifiers change.

## Organizational Boundary

ALX Foundation maintains the open protocol and its canonical conformance materials independently of any commercial product, application, service, or economic mechanism.

ALX Labs is the founding contributor and develops implementations, tooling, applications, services, and supporting infrastructure for the ALX ecosystem.

ALX Labs products and ecosystem services do not determine protocol conformance.

## Generated Artifacts

DOCX files and other generated publication derivatives are non-canonical.

Generated artifacts must:

* be produced from reviewed repository sources; and
* not replace repository sources as protocol authority.

## Related Documents

* [`GOVERNANCE.md`](./GOVERNANCE.md) — stewardship and decision authority
* [`MAINTAINERS.md`](./MAINTAINERS.md) — current responsibilities and contacts
* [`protocol/README.md`](./protocol/README.md) — normative artifact hierarchy
* [`docs/governance/versioning.md`](./docs/governance/versioning.md) — versioning and release rules
* [`CHANGELOG.md`](./CHANGELOG.md) — revision history

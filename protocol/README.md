# ALX Protocol � Normative Artifacts

---
---

The directory contains the canonical protocol artifacts for ALX Protocol.

SDKs, CLIs, examples, and reference implementations conform to the artifacts in the directory. The artifacts in the directory define the protocol contract. The listed surfaces conform to that contract.

## Normative Artifacts

| Path | Status | Purpose |
|---|---|---|
| [`spec.md`](spec.md) | Normative | Human-readable protocol specification |
| [`schemas/`](schemas/) | Normative | JSON Schema constraints for protocol documents (including [`schemas/test-vector.schema.json`](schemas/test-vector.schema.json) for core vector files) |
| [`test-vectors/`](test-vectors/) | Normative | Conformance vectors and semantic assertions |
| [`canonicalization.json`](canonicalization.json) | Normative | Machine-readable canonicalization rules |
| [`hashing.json`](hashing.json) | Normative | Machine-readable hash rules |
| [`verifier.json`](verifier.json) | Normative | Machine-readable Block verifier steps |
| [`graph-verifier.json`](graph-verifier.json) | Normative | Machine-readable graph verifier steps |
| [`limits.json`](limits.json) | Normative | Protocol and operational limits |
| [`error-codes.json`](error-codes.json) | Normative | Stable error-code registry |
| [`suites.json`](suites.json) | Normative manifest | Suite discovery and comparison modes |
| [`protocol.manifest.json`](protocol.manifest.json) | Normative manifest | Protocol bundle discovery |
| [`extensions/`](extensions/) | Extension-specific | Optional extensions outside core conformance |
| [`fixtures/`](fixtures/) | Informative | Valid and invalid schema fixtures |
| [`profiles/`](profiles/) | Informative | Optional content semantics for `Block.content` (guidance only) |

## Authority Hierarchy

1. `spec.md`
2. machine-readable protocol files in the directory
3. `test-vectors/`
4. `schemas/`
5. optional extension manifests under `extensions/`
6. informative fixtures under `fixtures/`

If a document outside `protocol/` contradicts the artifacts in the directory, the artifacts in the directory take precedence.

## Fixtures, Test Vectors, And Profiles

Three surfaces are easy to confuse. Each has a distinct role.

| Surface | Status | Purpose | Implementer requirement |
|---|---|---|---|
| [`test-vectors/`](test-vectors/) | Normative | Conformance inputs and expected outputs or semantic assertions | **Required** � pass suites listed in [`suites.json`](suites.json) |
| [`fixtures/`](fixtures/) | Informative | Example JSON that validates or rejects against [`schemas/`](schemas/) | **Not required** � schema hygiene for maintainers and CI |
| [`profiles/`](profiles/) | Informative | Optional semantic contracts for rich `Block.content` | **Not required** � opaque `content` remains valid without profiles |

**Test vectors** define what a conformant implementation must produce. The conformance runner replays vector files and compares outputs.

**Fixtures** prove that schemas accept intended shapes and reject invalid ones. CI runs `pnpm run verify:fixtures` via [`../conformance/bin/verify-fixtures.js`](../conformance/bin/verify-fixtures.js). Fixtures cover Block, Trace, verification context, content envelope, verification receipt, and extension document shapes under [`fixtures/`](fixtures/) and `extensions/*/fixtures/`.

**Profiles** describe optional machine-readable meaning inside `Block.content`. Profiles do not change Block identity, hashing, lineage, or core conformance. The optional [`schemas/content-envelope.schema.json`](schemas/content-envelope.schema.json) supports a `conformanceProfile` field when content elects a known profile. [`profiles/README.md`](profiles/README.md) holds guidance; profile definitions may expand in future releases.

## Conformance Model

Conformance is suite-specific.

Canonicalization vectors require exact byte output. Other suites assert protocol semantics, including hash identity, validation behavior, lineage behavior, trace correctness, and extension behavior.

A conformant implementation satisfies the expected outputs or semantic assertions defined by each suite in `suites.json`.

## Core Boundary

The core Block primitive remains:

```json
{
  "blockHash": "0x...",
  "contentHash": "0x...",
  "parentHashes": [],
  "content": {}
}
```

Core Block identity excludes:

- content-addressed storage identifiers;
- signatures;
- Merkle proofs;
- verification receipts;
- evidence bundles;
- storage provider metadata;
- application-specific meaning.

Listed features compose around Blocks through extensions, packages, receipts, or applications.

## Optional Extensions

Current optional extension areas:

- signing;
- Merkle proofs;
- content-addressed artifact package manifests.

Optional extensions are additive. Extensions preserve core conformance unless an implementation explicitly claims support for the extension.

## Versioning

- Protocol version: integer in [`VERSION`](VERSION)
- Breaking protocol changes require a protocol version change
- Additive rules, fixtures, and clarifications may keep the same protocol version when existing valid outputs remain unchanged
- SDKs use semver independently from protocol version

## For Implementers

1. Read [`spec.md`](spec.md).
2. Validate document shapes against [`schemas/`](schemas/).
3. Implement canonicalization and hashing from the machine-readable files.
4. Replay suites from [`suites.json`](suites.json).
5. Build a conformance adapter using [`../conformance/README.md`](../conformance/README.md).

## Schema Hosting

Machine-readable protocol files declare canonical `$id` URLs under:

```text
https://xandrlabs.github.io/alx-protocol/
```

GitHub Pages deploys protocol JSON artifacts from `main` via [`../scripts/build-protocol-site.js`](../scripts/build-protocol-site.js) and [`.github/workflows/pages.yml`](../.github/workflows/pages.yml). Each hosted path matches the `$id` URL path (for example, [`protocol/1/schemas/block.schema.json`](https://xandrlabs.github.io/alx-protocol/protocol/1/schemas/block.schema.json)).

The playground lives at the site root: [`https://xandrlabs.github.io/alx-protocol/`](https://xandrlabs.github.io/alx-protocol/).

## Related Documents

- [`../docs/implementers/implementer-guide.md`](../docs/implementers/implementer-guide.md)
- [`../docs/implementers/conformance.md`](../docs/implementers/conformance.md)
- [`../reference-implementations/README.md`](../reference-implementations/README.md)

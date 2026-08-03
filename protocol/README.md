# ALX Protocol Artifacts

This directory contains the ALX Protocol specification, schemas, conformance vectors, registries, and operational discovery files.

## Protocol Authority

| Path | Role | Purpose |
|---|---|---|
| [spec.md](spec.md) | Normative | Protocol behavior and requirements |
| [schemas/](schemas/) | Normative | Protocol document shapes and structural constraints |
| [test-vectors/](test-vectors/) | Normative | Exact outputs, rejection cases, boundaries, and semantic assertions |
| [error-codes.json](error-codes.json) | Normative | Core protocol error identifiers |
| [extensions/*/error-codes.json](extensions/) | Normative within each extension | Extension error identifiers |
| [suites.json](suites.json) | Operational | Conformance-suite discovery and comparison modes |
| [extensions/*/extension.json](extensions/) | Operational | Optional extension discovery |
| [fixtures/](fixtures/) | Informative | Valid and invalid schema examples |
| [chains/base-mainnet.json](chains/base-mainnet.json) | Informative | Application deployment configuration |
| [retrieval-api.yaml](retrieval-api.yaml) | Informative | Retrieval API description |

Canonical protocol behavior is defined by spec.md, schemas/, and test-vectors/. Exact error identifiers are defined by the applicable error registry. suites.json and extension manifests provide discovery metadata and do not define protocol behavior. Chain configuration describes application infrastructure and does not affect Block validity or identity.

If an implementation or explanatory document conflicts with a canonical protocol source, the canonical source takes precedence.

## Fixtures And Test Vectors

Test vectors define conformance inputs and required outputs or semantic assertions. The conformance runner discovers core suites through [suites.json](suites.json).

Fixtures verify that schemas accept intended document shapes and reject invalid shapes. pnpm run verify:fixtures validates core and extension fixtures and the error registries.

## Conformance Model

Conformance is suite-specific. Canonicalization vectors require exact byte output. Other suites assert hash identity, validation, lineage, Trace, and extension behavior.

An implementation conforms to a suite when it satisfies every applicable assertion declared by that suite.

## Core Boundary

The core Block shape is:

~~~json
{
  "blockHash": "0x...",
  "contentHash": "0x...",
  "parentHashes": [],
  "content": {}
}
~~~

protocolVersion is optional for version 1 Blocks as defined by [spec.md](spec.md) and [schemas/block.schema.json](schemas/block.schema.json).

Core Block identity excludes content-addressed storage identifiers, signatures, Merkle proofs, verification receipts, evidence bundles, storage-provider metadata, and application-specific meaning.

## Optional Extensions

Current optional extensions cover the Content Envelope profile, signing, and Merkle proofs. Extension behavior remains outside core Block identity and core conformance unless an implementation separately claims extension support.

The Content Envelope schema remains under [schemas/](schemas/) while extension discovery metadata lives under [extensions/content-profile/](extensions/content-profile/). Its public schema URL is `[Placeholder]` until a working replacement is published. Opaque `Block.content` remains valid without the profile.

## Optional Records

[schemas/verification-receipt.schema.json](schemas/verification-receipt.schema.json) defines an optional application record for completed Graph verification runs. Creating or exchanging a receipt is not required to create, validate, verify, or trace Blocks.

## Versioning

[VERSION](VERSION) declares the protocol version. Breaking protocol changes require a protocol-version decision. SDK packages use semantic versions independently from the protocol version.

## Implementation Sequence

1. Read [spec.md](spec.md).
2. Implement the document constraints in [schemas/](schemas/).
3. Replay the suites discovered through [suites.json](suites.json).
4. Build a conformance adapter using [../conformance/README.md](../conformance/README.md).

## Publication

Public URLs for ALX schema and registry JSON artifacts are currently `[Placeholder]`. The publication build skips those JSON artifacts until working identifiers are restored. [retrieval-api.yaml](retrieval-api.yaml) continues to use its configured publication path.

[../scripts/build-protocol-site.js](../scripts/build-protocol-site.js) builds the publication directory. [.github/workflows/pages.yml](../.github/workflows/pages.yml) publishes configured artifacts from main.

## Related Documents

- [../docs/implementers/implementer-guide.md](../docs/implementers/implementer-guide.md)
- [../docs/implementers/conformance.md](../docs/implementers/conformance.md)
- [../reference-implementations/README.md](../reference-implementations/README.md)

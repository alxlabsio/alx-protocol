# Integration Surfaces

Integration surfaces around ALX Protocol. Protocol behavior remains defined by [`../../protocol/spec.md`](../../protocol/spec.md).

---

## Overview

ALX keeps the core Block small.

Integrations live around the protocol. Integrations may store Blocks, package artifacts, sign receipts, fetch content, or expose Blocks to agents, but integrations must preserve:

- canonicalization;
- `contentHash` derivation;
- `blockHash` derivation;
- parent lineage rules;
- trace semantics.

Canonical behavior remains in:

```text
protocol/spec.md
protocol/schemas/
protocol/test-vectors/
```

## Current Integration Surfaces

| Surface | Location | Purpose |
|---|---|---|
| Artifact packages | `artifact-packages/` | Complete portable examples with Blocks, traces, receipts, and manifests |
| Package manifest guidance | `docs/integrators/artifact-package-manifest.md` | Storage mapping boundaries and vNext fields |
| `ipfs-artifact-package` extension | `protocol/extensions/ipfs-artifact-package/` | Optional package manifest schema and verification rules |
| Signing extension | `protocol/extensions/signing/` | Optional attestations around Blocks without changing identity |
| Merkle extension | `protocol/extensions/merkle/` | Optional checkpoint and inclusion-proof surface |
| CLI package verification | `cli/bin/alx.js` | `alx package verify <dir>` |

## Artifact Packages

Use artifact packages when a system needs a complete portable envelope around a Block.

A package can include:

- `block.json`;
- `content.json`;
- `blocks.json`;
- `trace.json`;
- `verification.json`;
- `manifest.json`;
- optional attestations or supporting files.

Verify a package:

```bash
alx package verify artifact-packages/security-review-decision --json
```

## Content-Addressed Storage

Content-addressed storage systems provide retrieval and availability.

ALX provides identity and lineage verification.

The package manifests include locally recomputable content-derived identifier v1 values for package files. Content-derived identifiers are storage metadata. Content-derived identifiers remain outside Block identity and exclude proof of pinning or live provider retrieval.

Production storage integrations should add:

- provider upload;
- provider retrieval;
- fetched-byte content-derived identifier verification;
- package replay verification after retrieval.

## Signing

Signing is optional and additive.

Use the signing extension when an attestor needs to make a claim about a Block or receipt.

Signing preserves the Block hash.

See:

```text
artifact-packages/signed-security-review-decision/
protocol/extensions/signing/
```

## Agents

Agents may produce content. The host application or SDK computes protocol validity.

Agents should avoid inventing hashes. Agents provide content and parent references to a conformant implementation, which computes:

- `contentHash`;
- `blockHash`;
- trace output;
- receipts.

## Related Documents

- [`artifact-package-manifest.md`](./artifact-package-manifest.md)
- [`agent-integration.md`](./agent-integration.md)
- [`storage.md`](./storage.md)
- [`extensions.md`](./extensions.md)
- [`../verification-receipts.md`](../verification-receipts.md)
- [`../../artifact-packages/START-HERE.md`](../../artifact-packages/START-HERE.md)

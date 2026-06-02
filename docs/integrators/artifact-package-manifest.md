# Artifact Package Manifest

Package manifest usage around ALX Blocks. Core Block identity remains defined by the protocol specification. Storage system selection remains an infrastructure-layer decision.

---

## Purpose

An artifact package manifest maps ALX identities to storage and package metadata.

The manifest helps surrounding systems answer:

- where is the Block stored?
- where is the content stored?
- where are parent Blocks stored?
- what optional evidence, attachments, attestations, or receipts travel with the package?

The manifest is outside core Block identity.

## Current Minimal Manifest

The current package manifest uses the minimal storage mapping:

```json
{
  "packageVersion": "1",
  "blockHash": "0x...",
  "contentHash": "0x...",
  "blockCid": "b...",
  "contentCid": "b...",
  "parents": [
    {
      "blockHash": "0x...",
      "cid": "b..."
    }
  ]
}
```

Layer separation:

| Layer | Responsibility |
|---|---|
| Block | Deterministic identity and parent-bound lineage |
| Trace | Computed lineage view |
| Receipt | Point-in-time verification result |
| Manifest | Storage and package mapping |
| Content-addressed storage | Retrieval and availability |

## Optional Resource Fields

Package manifests may include optional resource fields:

```json
{
  "attachments": [],
  "evidence": [],
  "attestations": [],
  "verificationReceiptCid": "b..."
}
```

Optional resource fields support richer storage and integration workflows.

Optional resource fields remain outside Block identity.

## Expanded Shape

```json
{
  "packageVersion": "1",
  "blockHash": "0x...",
  "contentHash": "0x...",
  "blockCid": "b...",
  "contentCid": "b...",
  "parents": [
    {
      "blockHash": "0x...",
      "cid": "b..."
    }
  ],
  "attachments": [
    {
      "id": "attachment-001",
      "role": "supporting-document",
      "path": "attachments/vendor-report.pdf",
      "cid": "b...",
      "contentHash": "0x..."
    }
  ],
  "evidence": [
    {
      "id": "evidence-001",
      "role": "test-output",
      "path": "evidence/eval-results.json",
      "cid": "b...",
      "contentHash": "0x..."
    }
  ],
  "attestations": [
    {
      "id": "attestation-001",
      "role": "block-attestation",
      "path": "attestations.json",
      "cid": "b..."
    }
  ],
  "verificationReceiptCid": "b..."
}
```

## Design Rules

The manifest excludes changes to Block validity.

A conformant Block remains valid without:

- a manifest;
- a content-derived storage identifier in the manifest;
- attachments;
- evidence files;
- attestations;
- a verification receipt content-derived identifier.

The manifest helps systems retrieve supporting material. Verification still recomputes Block identity from Block content and parent hashes.

## Content-Derived Identifier Verification Status

The current canonical package manifests contain locally recomputable content-derived identifier v1 values for package files.

The package verifier recomputes content-derived identifiers from local bytes and rejects mismatches:

```bash
alx package verify artifact-packages/security-review-decision --json
```

Expected shape:

```json
{
  "ok": true,
  "complete": true,
  "blockHash": "0x...",
  "contentHash": "0x...",
  "cidVerified": true,
  "missingParents": [],
  "externalParents": []
}
```

`cidVerified: true` means the manifest content-derived identifiers match the local package bytes for `block.json`, `content.json`, and resolved parent Block files.

Local verification confirms manifest-to-bytes mapping. Live retrieval from a content-addressed storage provider remains an integration-layer concern.

Production content-addressed storage integration should add:

- content-derived identifier parsing with a dedicated library;
- gateway or provider retrieval;
- fetched-byte verification;
- package replay verification after retrieval.

## Related Documents

- [`../../protocol/extensions/ipfs-artifact-package/README.md`](../../protocol/extensions/ipfs-artifact-package/README.md)
- [`../../protocol/extensions/ipfs-artifact-package/schemas/ipfs-artifact-package-manifest.schema.json`](../../protocol/extensions/ipfs-artifact-package/schemas/ipfs-artifact-package-manifest.schema.json)
- [`../verification-receipts.md`](../verification-receipts.md)
- [`../../artifact-packages/README.md`](../../artifact-packages/README.md)

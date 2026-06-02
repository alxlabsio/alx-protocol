# Extension Patterns

Additive extension patterns around ALX Protocol.

Extensions preserve core Block identity. Extensions leave core conformance unchanged unless an implementation explicitly claims support for an extension.

## Purpose

ALX Protocol keeps the protocol core small.

The protocol core defines Block identity, lineage, canonicalization, hashing, verification context, Trace behavior, and conformance.

Extension patterns add product or integration behavior around the protocol core.

## Core Boundary

The following concerns remain outside core Block validity:

- storage providers;
- content-derived storage identifiers;
- signatures;
- Merkle proofs;
- settlement systems;
- external registries;
- application-specific adapters;
- domain-specific content schemas.

## Current Extension Areas

| Extension area | Status | Purpose |
|---|---|---|
| Signing | optional extension | Attest to a Block or receipt without changing Block identity |
| Merkle proofs | optional extension | Checkpoint Block hashes or prove inclusion in a set |
| `ipfs-artifact-package` manifest | optional extension | Map ALX identities to package bytes and content-derived identifiers |

## Storage Pattern

Storage systems retrieve bytes. ALX verifies Block identity and lineage.

A storage integration may store:

- `block.json`;
- `content.json`;
- parent Blocks;
- verification receipts;
- artifact package manifests;
- evidence files.

A storage integration must preserve:

- `contentHash`;
- `blockHash`;
- `parentHashes`;
- canonicalization rules;
- validation rules.

## Signing Pattern

Signing is additive.

An attestation can make a claim about:

- a Block hash;
- a verification receipt;
- an artifact package;
- an organization or agent review.

An attestation preserves Block identity.

## Content-Addressed Package Pattern

The `ipfs-artifact-package` extension maps ALX hashes to content-derived identifiers.

Local content-derived identifier verification checks package bytes against manifest values. Local verification excludes live retrieval from a content-addressed storage provider, gateway fetch, or provider pinning.

Live retrieval can be added by an external integration:

```text
fetch by content-derived identifier -> verify fetched bytes -> replay package verification -> produce receipt
```

## Settlement Pattern

Settlement remains outside ALX core validity.

Settlement can be modeled as an optional product or application-layer extension for systems that need economic coordination around verified artifacts.

Settlement is optional for:

- Block creation;
- Block identity;
- lineage validation;
- local verification;
- protocol conformance.

## Content Schema Pattern

ALX content can remain opaque.

Applications may define content envelopes or domain schemas for routing, indexing, and product behavior. Application schemas help interpret content. Application schemas remain outside core validity unless the protocol explicitly adopts the schema in `protocol/`.

## Related Documents

- [`adapters.md`](./adapters.md)
- [`artifact-package-manifest.md`](./artifact-package-manifest.md)
- [`settlement.md`](./settlement.md)
- [`../verification-receipts.md`](../verification-receipts.md)
- [`../../protocol/extensions/`](../../protocol/extensions/)
- [`../../protocol/spec.md`](../../protocol/spec.md)

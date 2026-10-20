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
- network discovery services;
- application-specific adapters;
- domain-specific content schemas.

## Current Extension Areas

| Extension area | Status | Purpose |
|---|---|---|
| Signing | optional extension | Attest to a Block or receipt without changing Block identity |
| Merkle proofs | optional extension | Checkpoint Block hashes or prove inclusion in a set |
| Content Envelope | optional content profile | Add typed application structure inside `Block.content` |

Verification Receipt is an optional application record outside protocol extensions and core verification output.

## Storage Pattern

Storage systems retrieve bytes. ALX verifies Block identity and lineage.

A storage integration may store:

- complete Blocks;
- application-owned CID mappings or retrieval metadata;
- optional verification receipts.

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
- an organization or agent review.

An attestation preserves Block identity.

## Optional Record Pattern

The Verification Receipt schema describes a completed Graph verification run. Applications may create, store, sign, or exchange a receipt after verification.

A receipt remains an application record outside Block identity, Graph construction, and core conformance. A receipt captures a prior verification run only. Current Graph validity requires the relevant Blocks and an explicit Verification Context.

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

Applications may use the published [Content Envelope schema](../../protocol/schemas/content-envelope.schema.json) for typed, indexed, schema-bound, or conformance-bound content. Its [extension manifest](../../protocol/extensions/content-profile/extension.json) classifies the envelope as a provisional optional content profile.

Any valid ALX value in `Block.content` remains valid with or without the profile. The profile preserves Block identity and core conformance.

## Related Documents

- [`block-storage-adapters.md`](./block-storage-adapters.md)
- [`application-settlement-boundaries.md`](./application-settlement-boundaries.md)
- [`../verification-receipts.md`](../verification-receipts.md)
- [`../../protocol/extensions/`](../../protocol/extensions/)
- [`../../protocol/spec.md`](../../protocol/spec.md)

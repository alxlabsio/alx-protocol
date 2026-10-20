# Block Storage Adapters

Integration surfaces around ALX Protocol. Protocol behavior remains defined by [`../../protocol/spec.md`](../../protocol/spec.md).

---

## Overview

ALX keeps the core Block small.

Integrations live around the protocol. Integrations may store Blocks, sign optional records, fetch content, or expose Blocks to agents, but integrations must preserve:

- canonicalization;
- `contentHash` derivation;
- `blockHash` derivation;
- parent lineage rules;
- trace semantics.

Canonical behavior remains in:

```text
protocol/spec.md
protocol/schemas/
test-vectors/
```

## Current Integration Surfaces

| Surface | Location | Purpose |
|---|---|---|
| Local Block Store | `adapters/` | Memory, IndexedDB, and filesystem persistence outside protocol core |
| Content profile | `protocol/extensions/content-profile/` | Optional typed structure inside `Block.content` |
| Signing extension | `protocol/extensions/signing/` | Optional attestations around Blocks without changing identity |
| Merkle extension | `protocol/extensions/merkle/` | Optional checkpoint and inclusion-proof surface |
| Verification Receipt | `protocol/schemas/verification-receipt.schema.json` | Optional application record produced after Graph verification |

## Content-Addressed Storage

Content-addressed storage systems provide retrieval and availability.

ALX provides identity and lineage verification.

Applications may maintain locally recomputable Block-hash-to-CID mappings. CIDs are storage metadata outside Block identity. A CID establishes a content-addressed location only; pinning, availability, and live retrieval require separate checks.

Production storage integrations should add:

- provider upload;
- provider retrieval;
- fetched-byte content-derived identifier verification;
- Block verification after retrieval.

## Signing

Signing is optional and additive.

Use the signing extension when an attestor needs to make a claim about a Block or receipt.

Signing preserves the Block hash.

See [`protocol/extensions/signing/`](../../protocol/extensions/signing/).

## Agents

Agents may produce content. The host application or SDK computes protocol validity.

Agents should avoid inventing hashes. Agents provide content and parent references to a conformant implementation, which computes:

- `contentHash`;
- `blockHash`;
- trace output;
- optional receipt records.

## Related Documents

- [`agent-integration.md`](./agent-integration.md)
- [`storage.md`](./storage.md)
- [`extensions.md`](./extensions.md)
- [`../verification-receipts.md`](../verification-receipts.md)

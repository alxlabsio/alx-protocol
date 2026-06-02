# Verification Receipts

Verification receipts capture attribution results in a portable, replayable form. Core Block identity remains defined by the protocol specification.

---

## The Receipt As Attribution Certificate

A verification receipt is the portable proof that an attributed output was verified. When a pipeline produces an output with verifiable lineage, the receipt packages the result — block identity, attribution completeness, pathCount summary, and validation mode — in a plain JSON document that downstream consumers can inspect without access to the original SDK.

The receipt answers:

> What block was verified? Under which validation rules? Were all sources resolved? Was the attribution complete?

**Who uses receipts:**

- Auditors reviewing pipeline outputs
- Downstream systems accepting attributed content
- Compliance teams requiring proof of lineage
- CI/CD gates checking attribution completeness before release

A receipt excludes a requirement for the recipient to run the SDK. A recipient reads the receipt fields and, if needed, replays verification using the CLI.

## Purpose

A verification receipt records what a verifier checked at a point in time.

Receipts are useful for:

- audit exports;
- review records;
- CI/CD gates;
- signed approvals;
- package-level verification reports.

## Receipt Boundary

A receipt remains outside Block identity.

The core Block identity remains:

```text
blockHash = hash(content + parentHashes)
```

A receipt may reference a Block, a trace, a validation mode, and the verification result. A receipt leaves unchanged:

- `contentHash`;
- `blockHash`;
- `parentHashes`;
- Block validity.

## Point-In-Time Meaning

A receipt records a verification result at the time of production.

A receipt excludes a guarantee that files stored beside the receipt remain unchanged after production.

If package files may have changed, a verifier must replay verification against the current package state and compare the replayed result to the receipt.

A stale receipt can document a prior verification event while remaining non-authoritative for current package bytes.

## Tamper Detection Example

The package:

```text
artifact-packages/tampered-package-detection/
```

contains:

- a valid original package;
- a tampered package with an old successful receipt.

The old receipt still records the original verification result. The current package fails replayed verification because the content changed without recomputing the Block identity.

The behavior above is expected.

The receipt says:

> Verification succeeded at receipt production time.

Replay verification says:

> Current package files verify, or current package files fail verification.

## Signed Receipts

Signatures are additive.

A signed receipt can add accountability around a verification result, while Block identity remains separate from the signed receipt.

Signing may attest to:

- a Block hash;
- a receipt;
- a verification result;
- an organization or agent that performed review.

The signature must preserve the Block hash.

See:

```text
artifact-packages/signed-security-review-decision/
```

That package shows an Ed25519 attestation beside the verified Block.

## Recommended Verifier Behavior

A verifier should report:

```json
{
  "ok": true,
  "complete": true,
  "blockHash": "0x...",
  "validationMode": "closed-world",
  "missingParents": [],
  "externalParents": [],
  "errors": [],
  "warnings": []
}
```

For a tampered package, a verifier should return `ok: false` even if the stored receipt says the original package was valid.

## Replay Command

Use receipt replay to determine whether a stored receipt still matches the current package files:

```bash
alx receipt verify artifact-packages/security-review-decision/verification.json \
  --package artifact-packages/security-review-decision \
  --json
```

Expected shape:

```json
{
  "ok": true,
  "blockHash": "0x...",
  "receiptOk": true,
  "replayOk": true,
  "receiptComplete": true,
  "replayComplete": true,
  "receiptMatchesReplay": true,
  "errors": []
}
```

For a stale or tampered package, `receiptMatchesReplay` is `false`. The receipt may still describe a prior verification event, while current replay yields a mismatch against package bytes.

## Related Documents

- [`../protocol/spec.md`](../protocol/spec.md)
- [`../protocol/schemas/verification-receipt.schema.json`](../protocol/schemas/verification-receipt.schema.json)
- [`../artifact-packages/START-HERE.md`](../artifact-packages/START-HERE.md)
- [`../artifact-packages/tampered-package-detection/README.md`](../artifact-packages/tampered-package-detection/README.md)
- [`../artifact-packages/signed-security-review-decision/README.md`](../artifact-packages/signed-security-review-decision/README.md)

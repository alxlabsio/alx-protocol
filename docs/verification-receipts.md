# Verification Receipts

Verification Receipt is an optional application record for a completed Graph verification run. Core verification operates independently of receipts.

---

## Optional Record Boundary

A receipt records the verifier, Graph root, Verification Context, structural result, resolved Graph size, unresolved boundaries, errors, and warnings observed at one point in time.

A Verification Receipt is an application record outside Block identity and Graph construction. The record captures one verification event; current validity and availability require reverification.

## Purpose

A verification receipt records what a verifier checked at a point in time.

Receipts are useful for:

- audit exports;
- review records;
- automated review gates;
- signed audit records.

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

A receipt excludes a guarantee that referenced Blocks remain unchanged, available, or complete after production.

Current verification requires the relevant Blocks and the applicable Verification Context. Applications may compare a new result with a stored receipt.

A stale receipt can document a prior verification event while remaining non-authoritative for current Graph availability or validity.

## Reverification

A receipt records a prior result. Current results require consumers to verify the available Graph again under an explicit Verification Context.

## Optional Signing

An attestation over a receipt can add accountability for the record without changing the referenced Block or its `blockHash`.

Receipt signing remains optional signing-extension behavior outside core conformance.

## Verifier Behavior

A verifier may emit a receipt after completing Graph verification. The emitted record preserves the exact Verification Context and result fields defined by the receipt schema.

Consumers treat a receipt as a historical record; current verification uses the available Graph and an explicit Verification Context.

## Related Documents

- [`../protocol/spec.md`](../protocol/spec.md)
- [`../protocol/schemas/verification-receipt.schema.json`](../protocol/schemas/verification-receipt.schema.json)
- [`../protocol/schemas/verification-context.schema.json`](../protocol/schemas/verification-context.schema.json)

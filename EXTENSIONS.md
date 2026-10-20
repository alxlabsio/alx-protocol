# Optional Extensions

Status: public extension entry point

Optional extensions add capabilities around ALX Core without changing core
Block identity or becoming prerequisites for core conformance.

## Extension rules

The governing extension sources live under
[`protocol/extensions/`](./protocol/extensions/). Each supported extension may
define its own structures, processing rules, errors, vectors, manifest, and
conformance claim.

An optional extension remains separate from Core:

- extension data does not enter core `blockHash`;
- extension support is not required to create or validate a core Block;
- extension errors remain distinct from core error identifiers; and
- extension conformance is reported separately from core conformance.

## Current extension areas

| Area | Source |
|---|---|
| Content profile | [`protocol/extensions/content-profile/`](./protocol/extensions/content-profile/) |
| Merkle proofs | [`protocol/extensions/merkle/`](./protocol/extensions/merkle/) |
| Signing and attestations | [`protocol/extensions/signing/`](./protocol/extensions/signing/) |

Storage adapters, hosted indexes, Explorers, blockchain deployments, and
application schemas may integrate with ALX without becoming protocol
extensions or core validity requirements.

## Related documents

- [`IDENTITY.md`](./IDENTITY.md)
- [`CONFORMANCE.md`](./CONFORMANCE.md)
- [`docs/integrators/extensions.md`](./docs/integrators/extensions.md)

# Threat Model

This is the stable documentation entry point for ALX security and trust
boundaries.

Use the following maintained sources:

- [`trust-model.md`](./trust-model.md) explains verified properties and the
  properties excluded from ALX verification claims.
- [`../SECURITY.md`](../SECURITY.md) defines vulnerability reporting, security
  scope, adversarial-input expectations, and review status.
- [`governance/independent-security-review-plan.md`](./governance/independent-security-review-plan.md) records the
  repository's security-review status without representing internal testing as
  an independent audit.
- [`../protocol/spec.md`, sections 8 and 9](../protocol/spec.md#8-boundaries)
  contains the governing protocol boundary and non-goals.

## Layer boundary

Protocol security, implementation security, operational security, extension
security, and application policy are separate concerns. Storage, indexing,
retrieval, hosting, and blockchain anchoring may support an application while
remaining outside core Block validity.

## Related documents

- [`../GRAPH.md`](../GRAPH.md)
- [`architecture.md`](./architecture.md)
- [`governance/protocol-security-model.md`](./governance/protocol-security-model.md)

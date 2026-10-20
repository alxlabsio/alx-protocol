# Protocol Errors and Diagnostics

This guide explains how implementations expose ALX failures without making runtime-specific message text normative.

## Authority

The canonical core identifiers and classifications are in [`protocol/error-codes.json`](../../protocol/error-codes.json). Optional extensions maintain separate registries under [`protocol/extensions/`](../../protocol/extensions/README.md). Schemas and test vectors determine when structured outputs or request rejection apply.

This document is explanatory. If an example here differs from a registry, schema, vector, or the protocol specification, the canonical source controls.

## Stable And Unstable Parts

Conforming implementations must agree on behavior required by the applicable suite, including:

- whether an input is accepted or rejected;
- the canonical error code when a vector requires one;
- exact structured results for exact-output suites; and
- Graph outcome precedence and required issue fields.

Implementations may differ in exception classes, stack traces, localized prose, and diagnostic detail unless a vector explicitly fixes those values. Callers should branch on canonical codes or structured results, not English message text.

## Failure Layers

| Layer | Typical result | Canonical authority |
|---|---|---|
| Raw JSON ingress | Request rejection before protocol processing | Raw-ingress vectors and operation schema |
| Canonicalization | Canonicalization error code | Canonicalization vectors and registry |
| Block validation | Block validation result or error code | Block schema, identity vectors, registry |
| Graph request validation | Rejected request; no checked Graph result | Request/context schemas and Graph vectors |
| Graph verification | Complete `GraphVerification` envelope | Graph result schema and exact-output vectors |
| Trace verification | Trace result or canonical Trace code | Trace schemas and vectors |
| Optional extension | Extension-specific result or code | That extension's registry and vectors |

Do not turn an unavailable, syntactically valid parent into a definite protocol violation. In the canonical Graph operation, unavailable required Block data supports `incomplete`; a known violation takes precedence and produces `invalid`.

## Graph Verification Outcomes

`validateGraph(seed, source, context)` returns a checked result only after the request boundary is valid. Its status is one of:

| Status | Meaning |
|---|---|
| `valid` | Every check required by the supplied context completed successfully |
| `invalid` | At least one definite protocol violation was found |
| `incomplete` | Required Block data was unavailable and no violation was found |
| `resource_limit_reached` | A declared verification budget stopped work and no violation was found |

`checked: false` records that Graph verification was not requested or performed. It is not a fifth validation status. See [`GRAPH.md`](../../GRAPH.md) and [`011-graph-validation-outcomes.md`](../decisions/011-graph-validation-outcomes.md).

## Implementation Guidance

- Preserve the canonical code as a machine-readable field even when wrapping an error in a language-native exception.
- Attach implementation diagnostics separately from canonical output fields.
- Reject malformed request envelopes before returning a checked Graph result.
- Preserve deterministic ordering where a schema or exact-output vector requires arrays of issues or identities.
- Do not reuse a core code for an extension- or application-policy failure.
- Do not add freshness, authorization, replay, or storage policy to core Block or Graph validity.

## Verification

Run the suites declared in [`protocol/suites.json`](../../protocol/suites.json) through the shared conformance runner. Extension claims require their own suites. The repository's exact-result checks prevent message-only or partial-result comparisons from masking structural differences.

## Related Documents

- [`../../protocol/error-codes.json`](../../protocol/error-codes.json) — core registry
- [`../../protocol/extensions/merkle/error-codes.json`](../../protocol/extensions/merkle/error-codes.json) — Merkle registry
- [`../../protocol/extensions/signing/error-codes.json`](../../protocol/extensions/signing/error-codes.json) — signing registry
- [`./conformance.md`](./conformance.md) — conformance requirements
- [`../integrators/troubleshooting.md`](../integrators/troubleshooting.md) — operator-facing diagnosis

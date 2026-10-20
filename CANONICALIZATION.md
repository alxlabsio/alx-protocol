# Canonicalization

Status: public topic map; normative rules remain in the canonical sources

ALX canonicalization converts an ALX value into deterministic UTF-8 JSON text.
Its complete normative algorithm is defined in
[`protocol/spec.md`, section 2](./protocol/spec.md#2-canonicalization).

## Canonical sources

| Material | Authority |
|---|---|
| [`protocol/spec.md`, section 2](./protocol/spec.md#2-canonicalization) | Accepted ALX values, serialization rules, encoding, depth, grammar, and cross-language number behavior |
| [`test-vectors/canonicalization/`](./test-vectors/canonicalization/) | Exact canonical outputs and rejection cases |
| [`test-vectors/ingress/`](./test-vectors/ingress/) | Raw UTF-8 and JSON boundary cases before an ALX value exists |
| [`protocol/error-codes.json`](./protocol/error-codes.json) | Canonical failure identifiers |

## Processing boundary

```text
raw bytes, when accepted by an adapter
        |
        v
strict UTF-8 and JSON decoding
        |
        v
ALX value-domain validation
        |
        v
canonicalization
```

Raw malformed UTF-8, malformed JSON, trailing data, and duplicate object
members are ingress failures. They are not ordinary decoded-value
canonicalization cases.

Creation adapters may explicitly convert application values into ALX values.
Canonicalization itself does not silently convert unsupported language-native
objects or repair received protocol data.

## Conformance

Canonicalization is an exact-output concern. A conforming implementation must
satisfy every applicable canonicalization suite discovered through
[`protocol/suites.json`](./protocol/suites.json), including Unicode, number,
depth, rejection, and raw-ingress coverage.

## Related documents

- [`SPECIFICATION.md`](./SPECIFICATION.md) — canonical-source map
- [`IDENTITY.md`](./IDENTITY.md) — how canonical output enters identity derivation
- [`CONFORMANCE.md`](./CONFORMANCE.md) — conformance model

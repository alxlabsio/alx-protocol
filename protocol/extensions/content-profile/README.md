# Optional Content Profile

- **Status:** Provisional optional extension
- **Audience:** Integrators that choose typed Block content
- **Authority:** Extension classification and discovery metadata; core Block behavior remains governed by [`../../spec.md`](../../spec.md)
- **Last reviewed:** 2026-08-03

## Purpose

The Content Envelope is an optional content profile for applications that choose typed, indexed, schema-bound, or conformance-bound structure inside `Block.content`. Opaque JSON-serializable content remains valid without this profile.

The v1 schema remains available locally at [`../../schemas/content-envelope.schema.json`](../../schemas/content-envelope.schema.json). Its public schema URL is temporarily:

```text
[Placeholder]
```

Replace the placeholder after a working public schema URL is published.

Using this profile does not change canonicalization, `contentHash`, `blockHash`, parent relationships, Graph verification, Trace behavior, or core conformance. Applications independently decide whether to recognize or require the profile.

## Related Documents

- [`extension.json`](./extension.json)
- [`../../schemas/content-envelope.schema.json`](../../schemas/content-envelope.schema.json)
- [`../../../docs/integrators/extensions.md`](../../../docs/integrators/extensions.md)

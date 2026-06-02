# Canonical Envelope And Hash Derivation

The document explains how ALX Protocol derives deterministic Block identity from structured content, normalized parent references, canonical byte output, and Keccak-256 hashing.

The protocol specification and machine-readable protocol files remain authoritative for normative behavior.

---

ALX Protocol identity derivation has two stages:

1. **Canonicalization** — converts structured protocol input into deterministic UTF-8 bytes.
2. **Hash derivation** — derives cryptographic identity from canonical bytes using Keccak-256.

Together, the stages allow ALX Protocol Blocks to retain stable identity across implementations, runtimes, storage systems, artifact packages, and product workflows.

---

## 1. Canonicalization

Algorithm: `recursive-json-sort`

Canonicalization converts structured protocol input into a deterministic UTF-8 byte sequence.

Equivalent protocol inputs MUST produce identical canonical byte output across conformant implementations. This guarantee allows ALX identity, lineage, verification receipts, and conformance vectors to remain stable across languages and runtimes.

### 1.1 Primitive Canonicalization Rules

| Input Type | Canonical Output |
|---|---|
| `null`, `undefined` | `"null"` |
| `true` / `false` | `"true"` / `"false"` |
| Integer within safe range | Base-10 string without quotes |
| `-0` | `"0"` |
| Float | IEEE 754 shortest decimal representation using `JSON.stringify` semantics |
| String | JSON-escaped string with double quotes |
| `NaN`, `Infinity`, `-Infinity` | Error |
| `BigInt`, `Symbol` | Error |
| Integer outside safe range | Error |

### 1.2 Composite Canonicalization Rules

Arrays:

- preserve original element order
- canonicalize each element recursively
- serialize as `[element1,element2,...]`

Objects:

- sort keys lexicographically by UTF-16 code unit
- exclude properties with `undefined` values
- canonicalize each value recursively
- serialize as `{"key1":value1,"key2":value2,...}`

### 1.3 Recursion Constraints

Canonicalization MUST enforce a maximum recursion depth of 128.

Inputs that exceed the recursion limit MUST produce an error.

### 1.4 Encoding Rules

Canonical output MUST be encoded as UTF-8.

Unicode normalization is outside the canonicalization process. Code point sequences with differing encoded representations remain distinct.

Example:

```text
"é"  U+00E9
"é"  U+0065 + U+0301
```

---

## 2. Block Identity

ALX defines two identity-related hashes:

```text
contentHash = keccak256(canonicalize(content))
blockHash   = keccak256(canonicalize({ content, parentHashes }))
```

### 2.1 Canonical Input Structure

The canonical input to `blockHash` MUST be an object with exactly two keys:

- `content`
- `parentHashes`

After canonicalization, the object MUST serialize with deterministic key order:

```text
"content" < "parentHashes"
```

### 2.2 Hash Format

All ALX hashes MUST:

- use Keccak-256
- be encoded as lowercase hexadecimal
- include the `0x` prefix
- contain exactly 64 hexadecimal characters after the prefix

Hash format:

```text
^0x[a-f0-9]{64}$
```

### 2.3 `parentHashes` Normalization

Before `blockHash` derivation, `parentHashes` MUST be normalized into a deterministic parent set.

Normalization steps:

1. convert hash strings to lowercase
2. apply protocol hash-format handling
3. deduplicate entries
4. sort entries lexicographically

Properties:

- parent input order MUST NOT affect `blockHash`
- parent input casing MUST NOT affect `blockHash`
- duplicate parent entries MUST NOT affect `blockHash`
- normalized parent output MUST be reproducible across conformant implementations

Invalid parent-hash handling MUST match the protocol specification and conformance vectors.

---

## 3. Hash Scope

Block identity is derived only from canonical `content` and normalized `parentHashes`.

The following fields remain outside the hash envelope:

- timestamps
- metadata
- signatures
- Block type identifiers
- application-specific fields

Hash envelope:

```text
{ content, parentHashes }
```

## 4. Determinism Guarantees

Canonicalization and hash derivation provide the following guarantees:

- equivalent protocol input produces equivalent canonical byte output
- equivalent canonical byte output produces equivalent hash output
- independent implementations can reproduce the same `contentHash` and `blockHash`
- parent input ordering is irrelevant to lineage-bound Block identity
- fields outside the hash envelope can change without changing `blockHash`

## 5. Implementation Notes

These notes guide implementers without expanding protocol behavior.

- use a strict JSON serializer without pretty-printing
- match JSON string escaping rules exactly
- match UTF-16 code unit key ordering
- match IEEE 754 shortest decimal representation for floating-point values
- validate inputs before hash derivation
- treat canonicalization as a pure function
- preserve input values without mutation
- verify behavior against canonicalization and hash test vectors

---

## Related Documents

- [`../data-model.md`](../data-model.md) — Block field definitions and hash format
- [`lineage.md`](./lineage.md) — how `parentHashes` binds into lineage and Graph structure
- [`core-contract.md`](./core-contract.md) — core identity and hashing guarantees
- [`../../protocol/spec.md`](../../protocol/spec.md) — normative canonicalization and hashing rules
- [`../../protocol/test-vectors/canonicalization.json`](../../protocol/test-vectors/canonicalization.json) — canonicalization conformance vectors

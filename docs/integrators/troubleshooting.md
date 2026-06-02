# Troubleshooting Guide

Diagnosis and resolution for ALX Protocol SDK and CLI integration issues. Protocol behavior remains defined by [`../../protocol/spec.md`](../../protocol/spec.md).

---

## Purpose

Diagnose and resolve common errors when using the ALX Protocol SDK. Entries organize by symptom, cause, and resolution.

## Scope

Covers SDK errors, CLI errors, and common integration mistakes. For protocol-level error codes and recovery semantics, see [`../implementers/errors.md`](../implementers/errors.md).

---

## Block Validation Fails (Hash Mismatch)

**Symptom:** `validateBlock()` returns `{ ok: false }`.

### Cause 1: Content Modified After Creation

The most frequent cause. Any field in `content` that changes after `createBlock()` causes the stored `blockHash` to diverge from the recomputed hash.

```js
const block = createBlock({ text: "original" });
block.content.text = "modified"; // mutation!
validateBlock(block).ok; // false
```

**Resolution:** Avoid mutating a Block's `content` after creation. To change content, create a new Block.

### Cause 2: parentHashes Reordered Or Modified

`createBlock()` normalizes parentHashes (lowercase, deduplicate, sort). Manual Block construction with parentHashes in a different order or format than the normalized form produces a hash mismatch.

**Resolution:** Use `createBlock()` to construct Blocks. For manual construction, apply `normalizeHashes()` first.

### Cause 3: JSON Serialization Differs From Canonical Form

Serialization through a system that reorders keys, strips `null` values, or changes number formatting may prevent identical canonicalization after round-trip.

**Resolution:** Store Blocks as-is. After any transform, verify with `validateBlock()` after loading.

### Cause 4: Cross-Implementation Mismatch

See [Cross-implementation hash mismatch](#cross-implementation-hash-mismatch) below.

---

## Canonicalization Errors

### BigInt Rejection

**When:** `canonicalizeProtocolJson()` receives a `BigInt` value.

**Reason:** BigInt is absent from JSON. The protocol requires JSON-compatible values.

**Resolution:** Convert to string before creating a Block: `{ amount: "999999999999999999" }`.

### Symbol Rejection

**When:** Content contains a JavaScript `Symbol`.

**Resolution:** Symbols are absent from JSON. Remove Symbols or convert to strings.

### Non-Finite Number Rejection

**When:** Content contains `NaN`, `Infinity`, or `-Infinity`.

**Reason:** JSON excludes non-finite numbers. Cross-platform determinism requires rejection.

**Resolution:** Validate numbers before creating Blocks. Replace with `null` or a string representation if needed.

### Integer Out Of Safe Range

**When:** An integer exceeds `Number.MAX_SAFE_INTEGER` (2^53 - 1) or is below `Number.MIN_SAFE_INTEGER`.

**Reason:** JavaScript loses precision for integers outside the safe range. Different platforms would produce different hashes.

**Resolution:** Use strings for large integers: `{ tokenId: "9007199254740993" }`.

### Canonicalization Depth Exceeded

**When:** Content nesting exceeds 128 levels.

**Reason:** Guard against stack overflow from adversarial or malformed input.

**Resolution:** Flatten the data structure. 128 levels of nesting indicates a data modeling issue.

### Cyclic Reference Detected

**When:** Content contains circular object references (e.g., `obj.self = obj`).

**Reason:** JSON cannot represent cycles. The canonicalizer detects cycles before hitting the depth limit.

**Resolution:** Remove circular references. Use `JSON.parse(JSON.stringify(obj))` to strip cycles if needed.

---

## Hash Format Errors

### Invalid Hash String

**When:** `normalizeHash()` receives a string that fails to match `/^0x[a-f0-9]{64}$/`.

**Common causes:**
- Missing `0x` prefix: `"abc..."` instead of `"0xabc..."`
- Uppercase hex: `"0xABCD..."` — use lowercase
- Wrong length: hash is absent when the string is fewer or more than 64 hex characters (32 bytes)
- Placeholder values: `"0x_PLACEHOLDER..."` from fixture templates

**Resolution:** Ensure hashes are 0x-prefixed, lowercase, 64-character hex strings. Use `normalizeHash()` to validate before storing.

---

## Graph Validation Issues

### Self-Reference Detected

**Symptom:** `validateLineage()` or `validateGraph()` returns `selfRef: true`.

**Cause:** A Block lists its own `blockHash` in `parentHashes`.

**Resolution:** Self-reference is structurally invalid. A Block cannot be its own ancestor. Remove the self-referencing parent hash.

### Cycle Detected

**Symptom:** `validateGraph()` returns issues with `cycle: true`, or `traceAttribution()` returns `cycle: true`.

**Cause:** Two or more Blocks form a circular reference chain (A references B, B references A).

**Resolution:** Cycles violate the directed acyclic Graph requirement. Inspect the `issues` array in `GraphResult` and remove the offending reference.

### Missing Parents

**Symptom:** `validateLineage()` returns `missing` entries.

**Cause:** A Block references a parent hash that is absent from the known set.

**Note:** The flag appears only when the caller passes `knownHashes`. For a partial Graph, missing parents may be expected when the parent exists in another system.

**Resolution:** Add the missing parent Blocks to the Graph, or accept a partial Graph.

### Duplicate Parents

**Symptom:** `validateLineage()` returns `duplicates` entries.

**Cause:** The same parent hash appears multiple times in `parentHashes`.

**Note:** `createBlock()` automatically deduplicates parents. Duplicate entries occur only with manual Block construction.

**Resolution:** Use `createBlock()` or `normalizeHashes()` to deduplicate.

---

## Trace Errors

### rootHash Required

**When:** `traceAttribution()` receives an empty or falsy `rootHash`.

**Resolution:** Pass a valid Block hash as the first argument.

### Graph Type Requirement

**When:** `traceAttribution()` receives a value other than a `Map` for the graph parameter.

**Resolution:** Use `buildGraph(blocks)` to construct the Graph, or create a `Map` manually:

```js
const graph = new Map([
  [blockA.blockHash, blockA.parentHashes],
  [blockB.blockHash, blockB.parentHashes],
]);
```

---

## Cross-Implementation Hash Mismatch

When two implementations produce different hashes for the same input, the problem usually falls into one of these areas:

### Keccak-256 Versus SHA3-256

The most frequent cross-implementation error. ALX uses **Keccak-256** (the original Keccak submission), **SHA3-256** (the NIST-standardized version) produces different output for the same input.

- Go: Use `golang.org/x/crypto/sha3.NewLegacyKeccak256()`, avoid `sha3.New256()`
- Python: Use `pycryptodome`'s `Crypto.Hash.keccak` or `pysha3`, avoid `hashlib.sha3_256()`
- Rust: Use the `sha3` crate's `Keccak256`, avoid `Sha3_256`

### Float Serialization Differences

JavaScript's `JSON.stringify(0.1 + 0.2)` produces `"0.30000000000000004"`. Other languages may produce different representations. The spec requires IEEE 754 shortest representation matching JavaScript behavior.

**Resolution:** Run the canonicalization test vectors (`protocol/test-vectors/canonicalization.json`) and verify byte-identical output.

### Key Sorting Edge Cases

The function sorts object keys lexicographically by UTF-16 code unit (JavaScript's default `Array.sort()`). For ASCII keys the order matches byte order. For non-ASCII keys, verify the language sort matches JavaScript.

### Negative Zero

`-0` must canonicalize to `"0"` (positive zero). Some languages preserve the sign of negative zero.

**Resolution:** Run the full conformance test suite: `alx test-vectors run`.

---

## CLI Errors

### File Not Found

The file path passed to `alx block verify`, `alx block inspect`, or `alx graph trace` is absent from the filesystem.

**Resolution:** Verify the path. The CLI resolves relative paths from the current working directory.

### Invalid JSON

The file contains malformed JSON.

**Resolution:** Validate with `node -e "JSON.parse(require('fs').readFileSync('file.json','utf-8'))"` to locate the parse error.

### No Input Provided

Provide a file path, `--file` flag, or stdin input.

**Resolution:** Provide input: `alx block verify block.json` or pipe JSON via stdin to `alx block verify`.

---

## Related Documents

- [`../implementers/errors.md`](../implementers/errors.md) — normative error catalog
- [`./api-reference.md`](./api-reference.md) — SDK API reference
- [`./faq.md`](./faq.md) — frequently asked questions
- [`../../protocol/spec.md`](../../protocol/spec.md) — normative specification

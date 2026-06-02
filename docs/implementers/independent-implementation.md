# Independent Implementation Checklist

The checklist covers the minimum requirements for a conformant ALX Protocol implementation in any language.

---

## Normative Sources

Read these before writing any code:

1. [`protocol/spec.md`](../../protocol/spec.md) — normative specification
2. [`protocol/suites.json`](../../protocol/suites.json) — suite manifest
3. [`protocol/test-vectors/`](../../protocol/test-vectors/) — canonical vectors
4. [`protocol/schemas/`](../../protocol/schemas/) — JSON Schema constraints
5. [`conformance/README.md`](../../conformance/README.md) — conformance runner protocol

---

## Required Core Operations

Implement each operation to pass the core conformance suite:

| Operation | Description |
|---|---|
| `canonicalize(value)` | Deterministic JSON serialization |
| `deriveContentHash(content)` | keccak-256 of canonicalized content |
| `deriveBlockHash(content, parentHashes)` | keccak-256 of canonical `{content, parentHashes}` envelope |
| `normalizeHash(hash)` | Lowercase, validate format `0x[a-f0-9]{64}` |
| `normalizeHashes(hashes)` | Lowercase, validate, deduplicate, sort |
| `createBlock(content, parentHashes)` | Construct Block with derived hashes |
| `validateBlock(block)` | Recompute blockHash and compare |
| `validateLineage(block, graph)` | Check parent references against known Blocks |
| `buildGraph(blocks)` | Construct adjacency map from a Block set |
| `validateGraph(graph)` | Check for cycles, self-references, and missing parents |
| `traceAttribution(root, graph)` | Walk graph; compute pathCount, depth, edges, leaves |

---

## Canonicalization Rules

| Value type | Required output |
|---|---|
| `null` / `undefined` | `"null"` |
| boolean | `"true"` or `"false"` |
| integer | decimal string, no decimal point |
| float | IEEE 754 shortest representation |
| `-0` | `"0"` |
| string | double-quoted, JSON-escaped |
| array | preserve element order |
| object | keys sorted lexicographically |
| undefined object fields | omit |
| max depth | 128 levels |

Hash algorithm: **keccak-256**. SHA3-256 is a distinct algorithm and MUST NOT be substituted.

---

## Parent Hash Normalization

Before computing blockHash:

1. lowercase each hash
2. validate format: `^0x[a-f0-9]{64}$` — reject invalid entries
3. deduplicate
4. sort lexicographically
5. reject if count exceeds 256 (`MAX_PARENTS`)

---

## Conformance Adapter

The conformance runner communicates over stdin/stdout using newline-delimited JSON.

Each line in: `{ "op": "<operation>", ...input fields }`
Each line out: `{ "ok": true, "result": ... }` or `{ "ok": false, "error": "..." }`

Required ops: `canonicalize`, `deriveContentHash`, `deriveBlockHash`, `normalizeHash`, `normalizeHashes`, `createBlock`, `validateBlock`.

See [`conformance/README.md`](../../conformance/README.md) for the full adapter protocol.

---

## Running Conformance

Self-test (TypeScript reference):

```bash
pnpm run test:conformance
```

External implementation:

```bash
node conformance/bin/run.js --impl "./path/to/adapter"
```

All core suites must pass. Extension suites are optional unless the implementation claims extension support.

---

## Core Suite Pass Criteria

| Suite | Comparison mode | What it tests |
|---|---|---|
| `canonicalization` | exact-output | byte-identical canonical string for each input |
| `canonicalization-negative` | semantic | rejection of NaN, Infinity, BigInt, excess depth |
| `canonicalization-depth` | semantic | depth-limit enforcement |
| `block-identity` | semantic | contentHash and blockHash derivation |
| `parent-limits` | semantic | MAX_PARENTS boundary, normalization behavior |
| `attribution-trace` | semantic | trace structure, pathCount, depth, edges |
| `lineage-negative` | semantic | cycle detection, self-reference rejection |
| `lineage-boundaries` | semantic | closed-world and open-world graph behavior |
| `semantic-validity` | semantic | required validation outcomes |
| `semantic-integrity` | semantic | tamper and mismatch detection |

---

## Optional Extension Conformance

Merkle and signing are additive. Core Block identity is unaffected.

Claim Merkle support:

```bash
alx extension-conformance merkle
```

Claim signing support:

```bash
alx extension-conformance signing
```

---

## Common Failure Modes

| Failure | Cause |
|---|---|
| Hash mismatch | Using SHA3-256 instead of keccak-256 |
| Canonicalization mismatch | Key sort order, float formatting, or `-0` handling |
| Parent hash rejected | Hash format validation too strict or too loose |
| MAX_PARENTS not enforced | Missing the 256-parent ceiling |
| Graph cycles not detected | Missing cycle-detection in graph validation |

---

## Related Documents

- [`implementer-guide.md`](./implementer-guide.md) — detailed implementation walkthrough with Go reference code
- [`conformance.md`](./conformance.md) — conformance model and suite descriptions
- [`../../protocol/spec.md`](../../protocol/spec.md) — normative specification
- [`../../conformance/README.md`](../../conformance/README.md) — conformance runner

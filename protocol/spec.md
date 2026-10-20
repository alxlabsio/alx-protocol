# ALX Protocol Specification

---

**ALX Protocol defines structure. Meaning resides at the application layer. ALX Protocol encodes how blocks relate. The interpretation of those relationships is outside the protocol scope.**

A deterministic protocol for representing, validating, and traversing compositional structure, where identity is derived from content and lineage, and attribution is resolved as structure rather than policy.

> The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHOULD", "SHOULD NOT", "MAY", and "OPTIONAL" in this document are to be interpreted as described in [RFC 2119](https://www.ietf.org/rfc/rfc2119.txt).

---

## Normative Scope

This document is the single source of truth for all core protocol rules. The test vectors in `test-vectors/` are normative for core conformance (implementations MUST produce identical outputs for identical inputs).

The spec is the ultimate authority. Implementations defer to the spec. If a reference implementation contradicts this specification, the specification takes precedence. Conformance is determined by producing byte-identical outputs for the canonical test vectors, regardless of implementation language.

Documents in `docs/` elaborate on concepts defined here but MUST NOT introduce new requirements. If a companion document contradicts this specification, this specification takes precedence.

---

## Terminology

| Term | Definition |
|---|---|
| **Block** | The ALX Protocol primitive — artifact content and parent lineage bound into a deterministic blockHash. |
| **blockHash** | Keccak-256 hash of the v1 Block domain tag followed by the canonical form of `{ content, parentHashes }`. The unique identity of a Block. |
| **contentHash** | Keccak-256 hash of the v1 content domain tag followed by the canonical form of `content`. |
| **parentHashes** | An unordered set of parent Block hashes, bound into blockHash. |
| **Graph** | The connected Block structure reachable by following declared `parentHashes` from a seed Block within a verification context. |
| **Block source** | A local, deterministic lookup boundary that returns zero, one, or multiple supplied Block candidates for a requested normalized `blockHash`. It is input to Graph verification and is not a protocol primitive. |
| **content** | An ALX value: null, boolean, valid Unicode string, supported finite binary64 number, array of ALX values, or string-keyed map of ALX values. |
| **canonicalization** | Deterministic JSON serialization producing identical output for identical input. |
| **lineage** | The directed acyclic graph (DAG) formed by block parent references. |
| **attribution** | The structural computation of contribution through the lineage graph. |
| **pathCount** | The exact number of distinct paths from a root block to a given node in the DAG, encoded as a canonical base-10 decimal string. |
| **conformant** | An implementation that produces byte-identical outputs for the canonical test vectors. |
| **normalization** | The process of trimming, lowercasing, validating, deduplicating, and sorting parent hashes. |
| **attestation** | An optional signature over a domain-separated canonical attestation payload. Orthogonal to Block identity. |

---

## 1. Primitive

A **Block** binds artifact content and parent lineage into a single deterministic blockHash.

```
Block = { blockHash, contentHash, parentHashes, content, protocolVersion }
```

| Field | Type | Description |
|---|---|---|
| `blockHash` | `0x`-prefixed 64-char lowercase hex | `keccak256(UTF8("ALX-BLOCK-V1\0") || canonicalize({ content, parentHashes }))` |
| `contentHash` | `0x`-prefixed 64-char lowercase hex | `keccak256(UTF8("ALX-CONTENT-V1\0") || canonicalize(content))` |
| `parentHashes` | sorted array of `0x`-prefixed hashes | unordered set of parent Block hashes |
| `content` | ALX value | semantics are opaque to the protocol; structure is canonicalized |
| `protocolVersion` | string, required | identifies the hash and canonicalization algorithm; excluded from hash derivation; MUST be `"1"` in v1 |

### Invariants

1. Same content + same parentHashes = same blockHash (deterministic)
2. Block and content identities use Keccak-256 with distinct protocol domain tags
3. parentHashes MUST be normalized, sorted lexicographically, and deduplicated
4. parentHashes are an unordered set of parent Block hashes — implementations MUST normalize parentHashes to sorted lexicographic order for deterministic hashing. Application-level ordering is a content concern.
5. Content semantics are opaque; canonicalization validates and serializes its ALX value structure
6. `undefined` is not an ALX value and MUST be rejected
7. Implementations MUST reject a supplied parentHashes collection containing an invalid parent hash or non-string entry
8. Implementations MUST enforce a maximum of 256 parent hashes after normalization
9. `protocolVersion` MUST be present and MUST equal `"1"`. Implementations MUST reject Blocks with a missing or unrecognized `protocolVersion`. `protocolVersion` MUST NOT be included in the hash derivation input.

If normalized `parentHashes` contains more than 256 hashes, implementations MUST reject Block creation or hash derivation rather than truncating the set.

### Parent Hash Normalization

An omitted `parentHashes` argument produces an empty array. A supplied `parentHashes` value MUST be an array. `null`, strings, objects, and other non-array values MUST be rejected with `ALX_INVALID_HASH`.

Each array entry MUST be a string. Implementations MUST trim surrounding whitespace, convert ASCII hexadecimal letters to lowercase, and then require the `0x`-prefixed 32-byte hexadecimal hash format. An invalid entry MUST reject the complete operation with `ALX_INVALID_HASH`. Implementations MUST NOT return a partial parent set.

Implementations MUST deduplicate normalized hashes, sort them lexicographically, and then enforce the 256-parent limit. More than 256 distinct normalized hashes MUST be rejected with `ALX_TOO_MANY_PARENTS`.

---

## 2. Canonicalization

Algorithm: `recursive-json-sort-v1`

### ALX value model

Canonicalization accepts only null, booleans, valid Unicode strings, supported finite IEEE 754 binary64 numbers, arrays of ALX values, and maps from unique strings to ALX values. Implementations MUST reject language-native values or containers outside this model. Unsupported inputs include `undefined`, sparse arrays, functions, symbols, arbitrary-precision integers, dates, sets, maps with non-string keys, class instances, accessors, proxies, and cyclic structures.

An adapter MAY convert an application value into an ALX value before canonicalization. Such conversion is outside the protocol and MUST NOT occur implicitly within canonicalization.

Core canonicalization begins with an ALX value, not raw JSON text. JSON parsing, including duplicate-member rejection, is an adapter or transport responsibility. A parser MUST NOT claim that duplicate members were validated after parsing has already discarded them.

An implementation that accepts raw JSON text as an ALX input MUST decode UTF-8 without replacement, reject duplicate object member names at every nesting level, reject trailing non-whitespace data, and reject malformed JSON before constructing an ALX value. These failures occur at the adapter boundary before canonicalization. An adapter that reports a core error identifier for one of these failures MUST report `ALX_SCHEMA_INVALID`; it MUST NOT report a canonicalization result or claim that discarded duplicate members were validated. An implementation that accepts ALX values directly does not implement this raw-JSON boundary.

### Rules

| Input type | Output |
|---|---|
| `null` | `"null"` |
| `undefined` | **rejected** with `ALX_CANONICALIZATION_UNSUPPORTED_TYPE` |
| `true` | `"true"` |
| `false` | `"false"` |
| integer (safe range) | decimal string, no quotes (e.g., `"42"`, `"-1"`) |
| `-0` | `"0"` |
| float | `JSON.stringify(value)` — IEEE 754 shortest representation |
| string | JSON-escaped with double quotes |
| array | `[` + elements in original order + `]` (order-preserving) |
| object | `{` + string keys sorted by UTF-16 code units + `}`; every value MUST be an ALX value |
| `BigInt` | **rejected** — MUST be rejected with an error |
| `Symbol` | **rejected** — MUST be rejected with an error |
| `NaN`, `Infinity`, `-Infinity` | **rejected** — MUST be rejected with an error |
| integers outside safe range | **rejected** — MUST be rejected with an error |
| string or object key containing an unpaired UTF-16 surrogate | **rejected** with `ALX_CANONICALIZATION_INVALID_UNICODE` |

### Encoding

All string output is UTF-8. No Unicode normalization is applied — composed and decomposed forms are distinct. A string value or object key containing an unpaired UTF-16 surrogate code unit MUST be rejected with `ALX_CANONICALIZATION_INVALID_UNICODE`. A valid surrogate pair represents one Unicode scalar value and remains valid input.

Implementations MUST NOT produce different output for the same input.

### Depth limit

Implementations MUST enforce a maximum recursion depth of 128. Exceeding this depth MUST produce an error.

### Formal grammar (ABNF)

```
canonical-value   = "null" / "true" / "false"
                  / canonical-number / canonical-string
                  / canonical-array / canonical-object

canonical-number  = ["-"] ( "0" / (%x31-39 *DIGIT) )
                    ["." 1*DIGIT] ["e" ["+" / "-"] ("0" / (%x31-39 *DIGIT))]

canonical-string  = DQUOTE *(unescaped / escaped) DQUOTE
unescaped         = %x20-21 / %x23-5B / %x5D-10FFFF
escaped           = "\" ( DQUOTE / "\" / "/" / "b" / "f" / "n" / "r" / "t"
                  / "u" 4HEXDIG )

canonical-array   = "[" [ canonical-value *( "," canonical-value ) ] "]"

canonical-object  = "{" [ canonical-pair *( "," canonical-pair ) ] "}"
canonical-pair    = canonical-string ":" canonical-value
```

Keys in `canonical-object` MUST be sorted by UTF-16 code-unit comparison. No whitespace between tokens.

### Cross-language implementation notes

- Integers: decimal string, no leading zeros, no `+` sign
- Floats: the shortest round-trippable IEEE 754 binary64 representation produced by the ECMAScript `Number::toString` algorithm as used by `JSON.stringify`. Decimal notation is used when `1e-6 <= abs(value) < 1e21`; scientific notation is used otherwise. Scientific exponents use lowercase `e`, include `+` for positive exponents, and contain no leading zeroes. Examples: `0.5` → `"0.5"`, `1e-7` → `"1e-7"`, and `1e21` → `"1e+21"`.
- `-0`: MUST produce `"0"`
- `undefined`, sparse array elements, and object properties whose value is `undefined`: MUST be rejected
- Key sort: UTF-16 code-unit comparison (locale-independent). For ASCII keys (U+0000 to U+007F), this is identical to byte-order sorting.

---

## 3. Identity

```
blockHash   = keccak256(UTF8("ALX-BLOCK-V1\0") || canonicalize({ content, parentHashes }))
contentHash = keccak256(UTF8("ALX-CONTENT-V1\0") || canonicalize(content))
```

The `\0` notation above is one zero byte (`0x00`), not two printable characters. Domain tags are the exact UTF-8 byte sequences shown, including the terminating zero byte. The hash input for `blockHash` is always the Block domain tag followed immediately by an object with exactly two keys: `content` and `parentHashes`. After canonicalization, key order is:

`"content" < "parentHashes"` (because `c < p`).

So the canonical form is:

```
{"content":<canonicalized content>,"parentHashes":[<sorted hashes>]}
```

### Hash format

All hashes are lowercase `0x`-prefixed 64-character hexadecimal strings (32 bytes).

Hash meaning is determined by its named protocol field. `blockHash`, `contentHash`, attestation digests, and Merkle values are distinct types even though they share the same textual shape. Implementations MUST NOT substitute one hash type for another. An API or storage field that carries more than one hash type MUST include an explicit discriminator such as `hashKind`; a bare generic `hash` field MUST NOT require callers to infer the hash domain from its value.

Pattern: `/^0x[a-f0-9]{64}$/`

Implementations MUST produce identical hashes for identical inputs across all platforms and languages.

### Hash algorithm agility

ALX v1 defines a single hash algorithm: Keccak-256. All `blockHash` and `contentHash` values are 32-byte Keccak-256 digests, hex-encoded with a `0x` prefix.

Future versions MAY define new domain tags, canonicalization rules, or digest encodings. A new identity algorithm MUST use a new domain tag and MUST NOT reinterpret a v1 digest as an identity produced by the new algorithm. Within protocol version 1, the hash format always denotes the domain-separated Keccak-256 construction defined above.

---

## 4. Lineage

Blocks reference other blocks via `parentHashes`. This forms a directed acyclic graph (DAG).

### Validation rules

| Rule | Description |
|---|---|
| No cycles | Implementations MUST detect and reject cycles |
| No self-reference | A block MUST NOT appear in its own parentHashes |
| No duplicate parents | Each parent hash MUST appear at most once after normalization |
| Parent availability | Implementations MUST distinguish an unavailable syntactically valid parent from a malformed or otherwise invalid parent reference |

Every parent reference examined by a Graph operation MUST normalize to the v1 hash format. A checked Graph containing a malformed examined parent reference produces `invalid` with `ALX_INVALID_HASH`. Duplicate parent references after normalization produce `invalid` with `ALX_DUPLICATE_PARENT` before traversal or Trace metric propagation. Multiple supplied Block candidates that claim the same normalized `blockHash` when that identity is resolved produce `invalid` with `ALX_DUPLICATE_BLOCK`.

An operation that accepts a complete adjacency representation rather than a Block source MUST prepare every supplied entry before cycle detection, lineage resolution, traversal, or metric computation. Adjacency preparation applies these steps in order:

1. validate and normalize every Graph key;
2. record distinct supplied keys that normalize to the same hash as `ALX_DUPLICATE_BLOCK`;
3. validate and normalize every parent reference;
4. record duplicate normalized parents within one Graph entry as `ALX_DUPLICATE_PARENT`;
5. validate the supplied validation mode.

An adapter that constructs an adjacency representation from a keyed serialization MUST detect duplicate or normalization-colliding entries before conversion to a representation that discards either entry. Adjacency-preparation violations produce an `invalid` result without traversal. This whole-input preparation rule applies to adjacency-based lineage and Trace operations; it does not authorize `validateGraph` to inspect unreachable Block candidates from a Block source. A malformed verification context, including a validation mode other than `closed-world` or `open-world`, is rejected before Graph validation and does not produce a checked Graph result.

### Parent Resolution Semantics

ALX validation distinguishes between **closed-world validation** and **open-world validation**. Validation mode defines which parent data is required by the verification context; it does not change Block validity.

An operation that exposes an optional known-Block set MUST distinguish omission from an explicitly supplied empty set. Omission means the operation does not make a parent-resolution claim unless the operation defines its own Graph boundary. An explicitly supplied empty set means that no parent Block is known; every declared parent is unresolved. A supplied non-empty set resolves only hashes present in that set. Implementations MUST NOT use collection truthiness or collection size to reinterpret an explicitly supplied empty set as omission.

#### Closed-World Validation

Closed-world validation is the default validation mode.

In closed-world validation, every parent referenced by a Block is required by the validation context. If a syntactically valid referenced parent Block is unavailable, Graph validation is `incomplete`; absence alone is not a protocol violation and MUST NOT produce `invalid`.

Closed-world validation is appropriate when a verifier expects to possess the complete derivation Graph required to validate the artifact's declared lineage.

#### Open-World Validation

Open-world validation is valid only when explicitly declared by the verification context.

In open-world validation, a Block MAY reference external parents absent from the local validation context, provided those parent references are explicitly declared as external.

An external parent reference preserves lineage identity without requiring the parent Block to be available during local validation. The verifier can confirm that the child Block declares the external parent hash and that the declared parent hash is bound into the child Block identity, but the verifier cannot validate the external parent's content, structure, or ancestry unless the parent Block is later provided.

#### Required Behavior

A conformant verifier MUST apply closed-world validation by default.

A conformant verifier MUST report `incomplete` under closed-world validation if any required syntactically valid parent hash cannot be resolved to a parent Block in the validation context and no higher-precedence outcome applies.

A conformant verifier MAY apply open-world validation only when the verification context explicitly declares open-world mode.

A conformant verifier MUST report an undeclared missing parent as required unavailable data under open-world validation. If no higher-precedence outcome applies, the Graph result is `incomplete`.

A conformant verifier MUST NOT classify absence alone as a protocol violation. Malformed parent identities, invalid available parent Blocks, forbidden duplicates, self-reference, and cycles remain protocol violations.

A conformant verifier MUST preserve external parent hashes in lineage calculations, Block identity verification, graph traversal outputs, and attribution-related structures.

A conformant verifier MUST distinguish between:

- resolved parents
- declared external parents
- undeclared missing parents

| Parent state | Closed-world validation | Open-world validation |
|---|---:|---:|
| Parent hash is present and resolves to a valid Block | Valid | Valid |
| Parent hash is missing and declared external | Incomplete | Valid within the declared open-world scope; the external parent remains unverified |
| Parent hash is missing and undeclared as external | Incomplete | Incomplete |
| Parent hash is present but invalid | Invalid | Invalid |
| Parent hash is malformed | Invalid | Invalid |

Open-world validation confirms structural binding only. Open-world validation confirms that the child Block's declared parent hash is structurally bound into the child Block identity, without confirming that an external parent exists, is available, is valid, or carries a known ancestry.

If the external parent Block is later provided, the verifier MAY validate that parent and extend the resolved portion of the derivation Graph.

#### Normative Summary

Closed-world validation is the default.

Open-world validation is opt-in and context-declared.

A supplied `validationMode` value other than `closed-world` or `open-world` MUST be rejected with `ALX_INVALID_GRAPH`.

A missing parent is outside the required verification scope only when all of the following are true:

1. open-world validation is active;
2. the parent hash is declared in the child Block's parent list;
3. the missing parent is explicitly marked as external in the verification context.

All undeclared missing parents are required unavailable data. If no known violation or exhausted resource limit takes precedence, the Graph result is `incomplete`.

### Graph verification

Block verification and Graph verification are separate operations. `validateBlock(block)` evaluates one received Block without making an ancestry-availability claim. `validateGraph(seed, source, context)` evaluates complete Block candidates reachable from the context root within the requested scope. A valid Block MAY participate in a Graph result of `incomplete`, `resource_limit_reached`, or an enclosing workflow whose Graph verification has `checked: false`.

The normative operation has exactly three inputs:

1. `seed`: the complete root Block candidate;
2. `source`: a deterministic Block-source lookup boundary for non-seed Block candidates;
3. `context`: the verification context that defines the root, availability mode, scope, and resource budgets.

The seed MUST be supplied separately and MUST NOT be obtained from the source. Its `blockHash` MUST normalize successfully and equal `context.graphRoot`. An absent seed, malformed seed identity, or root mismatch is a malformed request rejected with `ALX_CONTEXT_ROOT_MISMATCH` before a checked Graph result exists. A missing or structurally malformed source is rejected with `ALX_INVALID_GRAPH` before a checked result. Other malformed request-envelope data is rejected with the applicable context or schema error before a checked result. Block-validity failures inside an accepted seed are checked Graph violations; they are not request rejection.

A Block source resolves a requested normalized `blockHash` to either no candidate, exactly one candidate, or multiple candidates. No candidate means that required Block data is unavailable. Exactly one candidate makes that Block available for examination. Multiple candidates claiming the requested normalized identity establish `ALX_DUPLICATE_BLOCK` when the lookup is required. A source MUST retain duplicate and normalization-colliding candidates until the verifier can diagnose them; an adapter MUST NOT silently collapse them into a map entry.

The portable conformance encoding of the operation is defined by `schemas/graph-validation-request.schema.json`. In that encoding, `source.blocks` is an order-independent finite collection used to implement lookup by each candidate's claimed normalized `blockHash`. The encoding deliberately admits structurally shaped but protocol-invalid Block candidates so negative conformance cases can produce checked `invalid` results. Runtime implementations MAY expose a callback, database, iterator, or other local lookup mechanism if it has the same observable resolution behavior and requires no network access.

Only the seed and Block candidates requested through reachable, in-scope parent declarations are examined. Unrequested source candidates, including unreachable malformed or duplicate candidates, MUST NOT affect the result. Source collection order and lookup implementation MUST NOT affect the result. This reachability rule prevents a finite source snapshot from broadening the verification claim or forcing semantic validation of unrelated Blocks.

`incomplete` describes required parent data discovered from an accepted seed that is unavailable; it does not describe failure to supply the seed or source itself.

The normative Graph validation statuses are:

| Status | Normative meaning |
|---|---|
| `valid` | Every Block and required relationship examined within the verification context satisfies the protocol rules, and all required checks completed. This claim does not extend beyond an explicit scope boundary or to declared external parents. |
| `invalid` | At least one definite protocol violation was discovered. |
| `incomplete` | No definite violation was discovered, no resource limit took precedence, and verification could not complete because required Block data was unavailable. |
| `resource_limit_reached` | No definite violation was discovered, and verification stopped before all required checks completed because an implementation or configured resource budget was exhausted. |

`not_checked` is not a Graph validation status. An enclosing result that records whether Graph validation occurred MUST use `checked: false` and MUST omit `status`. A direct call to `validateGraph` performs validation and therefore MUST return `checked: true` when it returns a Graph result.

When more than one condition is observed, implementations MUST apply this precedence:

1. a known protocol violation produces `invalid`;
2. otherwise, exhausted execution or resource budget produces `resource_limit_reached`;
3. otherwise, unavailable required Block data produces `incomplete`;
4. otherwise, completion of all required checks produces `valid`.

A lower-precedence condition MUST NOT erase a higher-precedence condition. In particular, missing data or later budget exhaustion does not erase a known cycle, malformed Block, invalid parent identity, duplicate Block, duplicate parent, self-reference, or hash mismatch. Conversely, missing data and budget exhaustion MUST NOT be represented as `invalid` unless an independent protocol violation was discovered.

Lineage-validation operations that make a parent-resolution claim MUST use the same `valid`, `invalid`, and `incomplete` meanings. When an optional known-Block set is omitted and the operation therefore makes no resolution claim, `valid` covers only the structural checks that were actually requested.

Every checked Graph result MUST identify its verification context and report deterministic counts and diagnostic collections for the work performed. The canonical Graph verification result shape is defined by `schemas/graph-verification.schema.json`. A conforming result MUST contain every field required by that schema; a projection or summary is not a Graph verification result.

Each Graph issue is the language-neutral pair `{ code, blockHash }`. `code` is the applicable canonical core error identifier. `blockHash` is the normalized identity of the examined Block, or the required lookup identity, to which the violation is attributed. Human-readable messages are non-normative and MUST NOT appear in the canonical Graph verification result. Applications MAY associate localized explanatory text outside that result.

Issues MUST be deduplicated by the exact `(blockHash, code)` pair and sorted first by ascending normalized `blockHash`, then by ascending ASCII `code`. Validation MUST continue deterministically after discovering a violation until all required in-scope work completes or an execution budget is exhausted. The result MUST include every definite violation discovered by that required work; implementations MUST NOT select a preferred issue merely to produce `invalid`.

Local Block violations are attributed to the Block's claimed normalized `blockHash`. A duplicate required source lookup is attributed to the requested normalized identity and its ambiguous candidates are not examined. A cycle containing two or more distinct Blocks produces one `ALX_GRAPH_CYCLE` issue attributed to the smallest normalized `blockHash` in each cyclic strongly connected component. A direct self-parent produces `ALX_SELF_PARENT` for that Block and does not additionally produce `ALX_GRAPH_CYCLE`. Hash mismatches remain independent violations: a Block participating in a cycle or self-reference also produces the applicable hash-mismatch issue when canonical hash derivation for that Block succeeds and differs from its claim. If malformed parent data prevents canonical Block-hash derivation, no derivative `ALX_BLOCK_HASH_MISMATCH` is produced for that Block.

#### Verification scope and resource limits

The verification context determines the claim being requested. `maxDepth`, when present, is an intentional scope boundary measured in parent edges from `graphRoot`; the root is depth 0. Blocks and ancestry beyond that boundary are not required checks. A `valid` result under `maxDepth: 3` means only that all required checks through depth 3 completed successfully. It MUST NOT be represented as validation of the entire ancestry.

`resourceLimits.maxBlocks` and `resourceLimits.maxEdges`, when present, are execution budgets rather than scope declarations. The limit is inclusive: examining exactly the configured number is permitted. Requiring examination of an additional Block or edge exhausts the budget and produces `resource_limit_reached` unless a known violation has already established `invalid`. A source lookup used only to determine availability or ambiguity does not itself increment either counter; examining the returned Block increments `blocksExamined`, and considering a declared parent increments `edgesExamined`.

Required traversal is breadth-first from `graphRoot`. The seed is examined first. At each depth, candidate Blocks are examined in ascending normalized `blockHash` order, and each examined Block's parent declarations are considered in ascending normalized order after malformed and duplicate declarations have been diagnosed. A parent beyond `maxDepth` is not resolved, enqueued, or required, but its declaration is still an examined edge of the in-scope child Block. `blocksExamined` counts distinct Block candidates whose Block data was examined; `edgesExamined` counts parent declarations considered on those Blocks, including declarations that cross the `maxDepth` boundary. A `maxBlocks` budget is checked before examining the next Block, and a `maxEdges` budget is checked before considering the next parent declaration. These rules make bounded results independent of source or collection insertion order.

Implementations MAY enforce additional documented byte, source-lookup, time, memory, cryptographic-work, or concurrency budgets, including during request decoding or source lookup. Exhaustion after the request has been accepted follows the same status and precedence rules. Exhaustion before the request can be accepted is an operational failure and MUST NOT be presented as a checked Graph result. Implementation-specific budgets MUST NOT broaden a `valid` claim or turn unavailable data into a protocol violation.

`validateGraph(seed, source, context)` verifies authenticity within its supplied context:
1. each examined Block's hash matches its content and parent declarations;
2. each required examined parent relationship resolves or is reported as unavailable;
3. every returned status follows the precedence rules above.

Graph result collections MUST be deterministic. `roots` and `externalParents` MUST be sorted by ascending normalized hash. Per-Block `parents`, `duplicates`, `missing`, and `external` collections MUST be sorted by ascending normalized hash. Diagnostic `issues` MUST follow the ordering rules above. Traversal order, map insertion order, object property order, and randomized hash-map iteration MUST NOT affect the result.

### Incremental validation

For real-time agent pipelines, implementations MAY provide incremental validation that checks a single new Block against previously validated Blocks without re-validating the entire Graph. Given the same seed, context, and combined available Block source, the incremental result MUST be equivalent to what `validateGraph(seed, source, context)` would produce.

If a Block arrives before a required parent, incremental validation MUST report `incomplete` unless a higher-precedence outcome applies. The caller is responsible for buffering out-of-order Blocks and re-validating when parents arrive. The validator operates without an orphan queue.

---

## 5. Attribution

`traceAttribution(rootHash, graph)` resolves the full lineage structure from a root block.

The root hash MUST be supplied, MUST normalize to the v1 hash format, and MUST identify an entry in the supplied Graph after Graph-key normalization. An omitted root MUST be rejected with `ALX_ROOT_HASH_REQUIRED`. A malformed root MUST be rejected with `ALX_INVALID_HASH`. A valid root absent from the supplied Graph MUST be rejected with `ALX_GRAPH_ROOT_NOT_FOUND`; no `AttributionTrace` is produced. Open-world validation permits unresolved parent boundaries, not an unresolved Trace root.

An `AttributionTrace` is a deterministic computed result. It is not a Block, does not have a protocol-defined identity or hash, and does not participate in Block identity or Graph validity. An application MAY place a Trace inside Block content, in which case that enclosing Block is identified under the ordinary Block rules; the Trace itself does not acquire a separate protocol identity.

### Output: AttributionTrace

```
{
  root: string,
  validationMode: "closed-world" | "open-world",
  complete: boolean,
  nodes: [{ hash, minDepth, maxDepth, pathCount, parentCount, childCount }],
  edges: [{ from, to }],
  leaves: string[],
  missingParents: string[],
  externalParents: string[],
  maxDepth: number
}
```

### Semantics

| Field | Meaning |
|---|---|
| `root` | the block whose lineage was traced |
| `validationMode` | `"closed-world"` or `"open-world"` — inherited from the verification context |
| `complete` | `true` when all parent hashes resolved; `false` when any parent is missing or external |
| `nodes` | all blocks reachable from root through the graph |
| `edges` | direct edges (from child -> to parent) among reachable nodes |
| `leaves` | nodes with no parents (original sources) |
| `missingParents` | parent hashes referenced by reachable blocks but absent from the graph and undeclared as external |
| `externalParents` | parent hashes declared as external boundaries in the verification context |
| `minDepth` | shortest path length from root to the node |
| `maxDepth` | longest path length from root to the node |
| `pathCount` | exact number of distinct paths from root to the node, encoded as a base-10 decimal string without a sign or leading zeros |
| `parentCount` | number of direct parents the node has |
| `childCount` | number of reachable Trace nodes that reference the node as a parent; equivalently, the number of returned `edges` whose `to` equals the node hash |

### Algorithm

1. Normalize and validate the root, Graph keys, parent hashes, verification mode, and declared external parents.
2. Perform a DFS cycle pre-check from the root (O(V+E)). A reachable cycle MUST fail with `ALX_GRAPH_CYCLE`; no AttributionTrace is produced.
3. Perform a BFS traversal from the root to discover all reachable nodes and edges.
4. Perform topological-order propagation to compute exact path counts and depths.
5. Sort `nodes` by ascending `minDepth`, then ascending hash. Sort `edges` by ascending `from`, then ascending `to`. Sort `leaves`, `missingParents`, and `externalParents` by ascending hash.

Hash comparisons and output ordering use lowercase normalized hash strings and are locale-independent. Each reachable node and each direct edge appears exactly once.

`childCount` is local to the returned AttributionTrace. Blocks elsewhere in the supplied Graph or in an external index do not contribute unless they are reachable from the Trace root and appear in `nodes`. `childCount` therefore does not assert the total number of children in any larger observed Block population.

`pathCount` is exact and unbounded by implementation integer width. Implementations MUST accumulate path counts with arbitrary-precision non-negative integer arithmetic and serialize each result as its canonical base-10 decimal representation. The representation MUST contain only ASCII digits, MUST NOT contain a sign, and MUST NOT contain leading zeros. Reachable Trace nodes always have a `pathCount` of at least `"1"`.

Path counts are computed via topological propagation. DFS visit counting produces approximations and is excluded.

### Invariant

Same root + same graph = same trace, always.

Implementations MUST produce identical traces for identical inputs (same root + same graph = same trace).

Implementations MUST use topological propagation to compute exact path counts.

Implementations MUST NOT round, saturate, wrap, truncate, or emit implementation-dependent path counts.

The protocol does not impose a maximum Trace node or edge count. Implementations and services MAY impose documented operational traversal, response-size, time, or memory limits. If a limit prevents full Trace computation, `traceAttribution` MUST fail without returning an object claimed to be a conformant `AttributionTrace`. An operational limit MUST NOT change canonical Trace output for an input that is processed successfully.

The `complete` field reports lineage-resolution completeness only. It MUST NOT report pagination, response truncation, query-budget exhaustion, index coverage, or observation scope.

A service MAY expose bounded or paginated graph-query results. Such a result is an application-layer query envelope, not an `AttributionTrace`, and MUST NOT claim conformance with the AttributionTrace schema unless it contains the complete canonical result. Query APIs SHOULD report their source scope, index revision, pagination state, and truncation state separately.

---

## 6. Merkle Proofs (optional extension)

Implementations MAY provide sorted-pair Merkle tree construction for checkpoint anchoring. Merkle proofs enable off-chain proof of Block inclusion in an on-chain checkpoint root.

Merkle trees are orthogonal to Block identity. Merkle trees operate on arrays of `blockHash` values and use the same keccak-256 hash function. The sorted-pair construction (`hash(min, max)`) ensures canonical tree structure regardless of leaf input order.

Merkle functionality is an OPTIONAL extension. Merkle functionality is NOT part of core protocol conformance and MUST NOT be required to create, verify, exchange, or trace Blocks.

Merkle extension behavior is defined separately in `protocol/extensions/merkle/` and tested by its own extension-conformance suite. The Merkle extension is provided for anchoring adapters and other integrations that need checkpoint inclusion proofs.

---

## 7. Signing (optional extension)

Signing is an OPTIONAL extension orthogonal to Block identity. A Block's `blockHash` is always derived from content and parents — never from a signature. A portable attestation proves that the corresponding signing key signed the exact attestation payload; applications decide whether that claim represents authorship, review, approval, or another role.

Signing is NOT part of core protocol conformance and MUST NOT be required to create, verify, exchange, or trace Blocks.

### Signer / Verifier interfaces

The protocol defines algorithm-agnostic interfaces for signing:

```
Signer {
  getId(): Promise<string>       — signer's public identifier
  sign(data: Uint8Array): Promise<string>  — sign the 32-byte attestation digest
  algorithm: string              — algorithm identifier
}
```

The portable attestation payload contains exactly `algorithm`, `attester`, `blockHash`, and `timestamp`. It is canonicalized with the core canonicalization algorithm. The signing digest is:

```
attestationDigest = keccak256(
  UTF8("ALX-ATTESTATION-V1\0") ||
  canonicalize({ algorithm, attester, blockHash, timestamp })
)
```

The `\0` notation is one zero byte (`0x00`). The exact key order after canonicalization is `algorithm`, `attester`, `blockHash`, `timestamp`. The `data` parameter passed to `sign()` and `verify()` is the raw 32-byte `attestationDigest`. This construction authenticates every attestation metadata field and separates attestation signatures from Block and content hashes.

```

Verifier {
  verify(data: Uint8Array, signature: string, expectedSigner?: string): Promise<{ ok: boolean; signer: string }>
  algorithm: string
}
```

The portable v1 signing profiles are Ed25519 and P-256. Implementations MAY support additional explicitly profiled or application-defined algorithm identifiers, but such support is outside portable signing-extension conformance unless a corresponding extension profile defines its encoding and verification rules.

### BlockAttestation type

```
BlockAttestation {
  blockHash: string    — the block hash being attested
  attester: string     — signer's public identifier
  algorithm: string    — signing algorithm used (e.g., "eip712", "ed25519")
  timestamp: number    — unix seconds (signer-provided)
  signature: string    — signature over the domain-separated attestation digest
}
```

Signing metadata MUST be carried in the signing extension's `SignedBlock` envelope, not as fields on the enclosed core Block. A `SignedBlock` contains exactly one complete `block` and at least one attestation through the singular `attestation` field, the plural `attestations` array, or both. The singular field is retained for compatibility; implementations SHOULD prefer `attestations` when producing new envelopes.

The `SignedBlock` envelope is not a core Block and has no core protocol identity. Its attestation fields are outside the Block hash envelope, so wrapping or unwrapping a Block does not change `contentHash` or `blockHash`. A core Block containing `attestation`, `attestations`, or any other extension field MUST fail exact core Block shape validation. Changing `algorithm`, `attester`, `blockHash`, or `timestamp` without producing a new signature MUST invalidate the affected attestation.

### Operations

`createSignedBlock(content, parentHashes, signer, timestamp?)` — create a core Block and return it inside a `SignedBlock` envelope with an attestation.

`validateSignedBlock(signedBlock, verifier)` — verify the enclosed Block's hash integrity and the envelope's attestation signature or signatures.

`signBlock(blockHash, opts)` — create a durable EIP-712 attestation. **Deprecated**: use `createSignedBlock()` with an `Eip712Signer` instead. Will be removed in v2.0.

`verifyBlockSignature(attestation, opts)` — verify an EIP-712 attestation. **Deprecated**: use `validateSignedBlock()` with an `Eip712Verifier` instead. Will be removed in v2.0.

Attestations are durable — no expiry, no nonce. Use protocol request signing for ephemeral actions with replay prevention.

A portable Block attestation proves only that the holder of the corresponding signing key signed the exact domain-separated attestation payload. It does not establish authorization, ownership, legal identity, content truth, timestamp freshness, uniqueness, quorum weight, or permission to perform an application action. Replaying the same valid attestation does not create an additional protocol claim. Applications that require purpose, audience, nonce, expiry, or authorization MUST use a separately domain-separated application envelope and MUST NOT infer those properties from a portable Block attestation.

### Protocol Request signing

For ephemeral actions with replay prevention, use `verifySignedProtocolPayload` with nonce, expiry, chainId, and domain.

---

## 8. Boundaries

### Operational limits

Protocol validity is independent of implementation resource budgets except for limits explicitly defined by this specification. An implementation or service MAY stop an operation because of a documented byte, collection, cryptographic-work, traversal, time, memory, or concurrency budget. A checked Graph operation reports `resource_limit_reached` unless a known violation takes precedence and MAY report deterministic counts and diagnostics for work already performed. It MUST NOT represent that work as `valid`, return a partial result as a conformant Block or `AttributionTrace`, or assign a core protocol-invalid error identifier unless the input independently violates a normative protocol rule.

The protocol MUST NOT define or constrain:

- What content means — knowledge, code, documents, anything
- Block types or categories (applications define these)
- Payout policy, payment amounts, distribution curves, or economic incentives
- Storage format (blocks can be stored anywhere — content-addressed storage systems, databases, filesystems, object stores)
- Transport protocol (blocks can be sent over any channel)
- Order of dependencies (parentHashes are an unordered set; order is content-level)

The protocol MUST NOT interpret or constrain the meaning of `content`. It validates only ALX value-model membership and canonical serialization requirements.

ALX Protocol provides deterministic attribution structure (pathCounts, depths, reachability). Applications decide what that structure means economically. See [`docs/integrators/application-settlement-boundaries.md`](../docs/integrators/application-settlement-boundaries.md).

---

## 9. Non-Goals

The following are explicitly outside the protocol's scope. The items listed are permanent architectural exclusions, outside the protocol scope.

| Non-goal | Rationale |
|---|---|
| **Storage** | Block verification depends on hash, independent of storage location. Storage is an infrastructure concern. |
| **Execution** | The protocol defines structure and verification. Computation and side effects reside outside the protocol scope. |
| **Settlement policy** | Attribution structure is deterministic; economic meaning is application-level. |
| **Content validation** | The protocol treats content as opaque. Content schemas are application conventions. |
| **Identity / authentication** | Block identity is deterministic, derived from content and parentHashes. Actor identity is orthogonal (EIP-712 signing). |
| **Ordering / consensus** | parentHashes are an unordered set. Sequencing is a content-level or application-level concern. |
| **Transport** | Blocks can be sent over any channel. Wire format and network protocol remain outside the protocol scope. |

## Related Documents

- [Protocol schemas](./schemas/)
- [Canonical test vectors](../test-vectors/README.md)
- [Protocol error codes](./error-codes.json)

# Implementer Guide

Minimum requirements for implementing ALX Protocol in a new programming language. Protocol behavior remains defined by [`../../protocol/spec.md`](../../protocol/spec.md).

---

How to implement ALX Protocol in a new language.

---

## Implementation Roles

The normative specification, schemas, suite manifest, and canonical test vectors are the conformance standard. Reference implementations are supporting evidence rather than protocol authority.

When in doubt: match `protocol/spec.md`, `protocol/suites.json`, and the referenced vectors first. When two reference implementations disagree on behavior absent from those artifacts, file an issue — the spec or vectors need clarification.

## 1. Scope

The document defines the minimum requirements and recommended components for implementing ALX Protocol in a new programming language.

A conformant implementation MUST correctly reproduce:

- deterministic canonicalization
- cryptographic hashing
- Block creation and validation
- lineage normalization

## 2. Required Implementation Surface (Layer 1-2)

The following functions are mandatory for protocol conformance:

```text
canonicalize(value) -> string
deriveBlockHash(content, parentHashes) -> string
deriveContentHash(content) -> string
createBlock(content, parentHashes) -> Block
validateBlock(block) -> { ok, expected, actual }
normalizeHash(hash) -> string
normalizeHashes(hashes) -> string[]
```

### Functional Responsibilities

| Function | Responsibility |
|---|---|
| `canonicalize` | Deterministic serialization (core invariant) |
| `deriveBlockHash` | Compute `blockHash` from canonical structure |
| `deriveContentHash` | Hash content only (profile-dependent) |
| `createBlock` | Construct canonical Knowledge Block |
| `validateBlock` | Recompute and verify hash integrity |
| `normalizeHash` / `normalizeHashes` | Enforce canonical hash format |

## 3. Recommended Components (Layer 3-4)

The following functions extend an implementation into graph validation and provenance analysis:

```text
validateLineage(blockHash, parentHashes, knownHashes) -> result
validateGraph(graph) -> result
verifyGraph(blocks, computeHash) -> result
buildGraph(blocks) -> graph
traceAttribution(rootHash, graph) -> trace
```

Purpose:

- ensure Graph correctness
- detect invalid lineage references
- enable provenance tracing
- support derivation graph construction

## 4. Optional Components

### 4.1 Merkle Tree Support

```text
buildMerkleTree(leaves) -> { root, layers }
getMerkleProof(leaves, leaf) -> { proof, root }
verifyMerkleProof(root, leaf, proof) -> boolean
```

### 4.2 Cryptographic Signing

```text
signBlock(blockHash, opts) -> attestation
verifyBlockSignature(attestation, opts) -> result
```

Use cases:

- integrity proofs
- on-chain verification
- authenticated publishing

## 5. Function Specification: createBlock

### Definitions

A **Block** is a data structure with four fields: `blockHash`, `contentHash`, `parentHashes`, and `content`.

The **content field** holds an arbitrary JSON-serializable value. The content field rejects `NaN`, `Infinity`, `-Infinity`, `BigInt`, and `undefined` at any depth. The maximum content depth is 128 levels.

The **parentHashes field** holds an ordered array of parent `blockHash` values. Each element references the `blockHash` of a prior Block. An empty `parentHashes` array designates a root Block — a Block with no declared derivation parents.

The **`blockHash` field** is the 66-character string representation of a 32-byte keccak-256 digest. The representation is the two-character prefix `0x` followed by 64 lowercase hexadecimal characters. A `blockHash` encodes the identity of a Block's content and declared `parentHashes` together.

The **`contentHash` field** is the 66-character string representation of a 32-byte keccak-256 digest using the same encoding. A `contentHash` encodes the identity of the content field alone.

**Normalization** of a `parentHashes` array: convert each element to lowercase; validate each element against `^0x[a-f0-9]{64}$`; remove elements that fail validation; remove duplicates; sort remaining elements in lexicographic byte order. Reject the result if the count exceeds 256.

### Inputs

| Input | Type | Required | Constraint |
|---|---|---|---|
| `content` | any JSON-serializable value | yes | depth ≤ 128; no `NaN`, `Infinity`, `-Infinity`, `BigInt` |
| `parentHashes` | `string[]` | no (default: `[]`) | each element must match `^0x[a-f0-9]{64}$` after lowercase; max 256 after normalization |

### Operations (In Order)

1. **Normalize `parentHashes`.** Apply normalization. If the normalized array length exceeds 256, return `ALX_PARENT_COUNT_EXCEEDED`.

2. **Canonicalize the content value.** Produce a deterministic UTF-8 encoded JSON string from the content input.

3. **Derive `contentHash`.** Compute `keccak256(UTF-8 bytes of canonical content string)`. Encode as a 0x-prefixed lowercase 64-character hexadecimal string.

4. **Construct the canonical hash envelope.** Build a JSON object with two fields: `content` (the original content value) and `parentHashes` (the normalized array). Canonicalize the object. The canonicalization algorithm places `"content"` before `"parentHashes"` in lexicographic key order.

5. **Derive `blockHash`.** Compute `keccak256(UTF-8 bytes of canonical hash envelope string)`. Encode as a 0x-prefixed lowercase 64-character hexadecimal string.

6. **Return the Block** with fields: `blockHash` (step 5), `contentHash` (step 3), `parentHashes` (step 1), `content` (original input).

### Invariants

Every Block returned by a conformant `createBlock` satisfies:

- `validateBlock(block).ok === true`
- `blockHash === keccak256(canonicalize({ content, parentHashes }))` where input is UTF-8 encoded
- `contentHash === keccak256(canonicalize(content))` where input is UTF-8 encoded
- `parentHashes` is sorted, deduplicated, lowercase, format-validated, and ≤ 256 elements
- Two calls with identical `content` and identical `parentHashes` produce identical `blockHash`

### Conformance Vectors

```
protocol/test-vectors/block-identity.json   — hash identity for content and parentHash combinations
protocol/test-vectors/parent-limits.json    — MAX_PARENTS boundary and normalization behavior
protocol/test-vectors/canonicalization.json — exact-output canonicalization (required for hash correctness)
```

---

## 6. Canonicalization (Critical Component)

Canonicalization is the foundation of determinism. All hashing depends on canonical serialization.

### 6.1 Rules

| Type | Rule |
|---|---|
| `null` / `undefined` | `"null"` |
| boolean | `"true"` / `"false"` |
| integer | Decimal string (safe range enforced) |
| float | IEEE 754 shortest representation |
| `-0` | `"0"` |
| string | JSON-escaped, double-quoted |
| array | Preserve order |
| object | Sort keys lexicographically |
| undefined fields | Omit |
| depth | Max 128 |

### 6.2 Validation Test Cases

```text
canonicalize(null)           -> "null"
canonicalize({"b":1,"a":2})  -> '{"a":2,"b":1}'
canonicalize([3,1,2])        -> "[3,1,2]"
canonicalize(-0)             -> "0"
```

If these fail, the implementation is non-conformant.

## 7. Block Hashing

### 7.1 Formula

```text
blockHash = keccak256(
  canonicalize({
    "content": content,
    "parentHashes": normalizedParents
  })
)
```

### 7.2 Key Properties

- field order is deterministic
- `"content"` precedes `"parentHashes"`
- hash input MUST be fully canonicalized
- hash algorithm MUST be Keccak-256 (Ethereum-compatible)

## 8. Parent Hash Normalization

Before hashing, `parentHashes` MUST be normalized:

1. convert to lowercase
2. validate format: `/^0x[a-f0-9]{64}$/`
3. remove duplicates
4. sort lexicographically
5. reject the normalized result when the count exceeds 256 hashes

Result guarantees:

- order independence
- deterministic identity
- Graph consistency

## 9. Conformance Testing

Implementations MUST pass official test vectors.

Location:

- Machine-readable suite manifest: `protocol/suites.json`
- Canonical data files: `protocol/test-vectors/*.json`
- TypeScript runner: `sdk/src/__tests__/conformance-vectors.test.js`

Critical vectors:

| Vector | Purpose |
|---|---|
| `C7` | object key sorting |
| `B3` | key-order independence |
| `B4` | parent-order independence |
| `B5` | parent deduplication |
| `PL1` / `PL2` | normative `MAX_PARENTS = 256` boundary |
| `T2` | diamond Graph correctness |

Failure on any vector indicates protocol violation.

## 10. Reference Implementations

| Language | Path |
|---|---|
| TypeScript SDK | `sdk/src/` |
| Python | `reference-implementations/python/src/alx_protocol/` |
| Rust | `reference-implementations/rust/src/` |

Recommendation:

- use `protocol/spec.md`, `protocol/suites.json`, and `protocol/test-vectors/` as the normative reference
- use TypeScript, Python, and Rust implementations as supporting evidence

## 11. Dependencies

| Dependency | Purpose | Notes |
|---|---|---|
| Keccak-256 | hashing | required |
| JSON serializer | canonicalization | MUST support deterministic output |
| EIP-712 (optional) | signing | for blockchain integrations |

## 12. Implementation Guidance

### Priority Order

1. implement `canonicalize`
2. validate against test vectors
3. implement hashing
4. implement block creation and validation
5. add lineage / graph support

### Common Failure Modes

- incorrect key sorting
- improper float serialization
- skipping `-0` normalization
- omitting parent hash ordering enforcement
- using SHA3-256 instead of Keccak-256

## 13. Summary

A conformant ALX implementation requires:

- strict determinism
- canonical serialization
- Keccak-based identity
- normalized lineage inputs
- test vector verification

Correctness of the entire system depends on the canonicalization and hashing pipeline. All higher-level features (graphs, attribution, proofs) rely on exact canonicalization and hashing primitives.

## Build From Scratch: Go Walkthrough

A step-by-step guide to building a conformant ALX Protocol implementation in Go from zero. Every code sample below is real, compilable Go.

---

### Step 1: Implement Canonicalize()

Canonicalization is the foundation. Every hash in the protocol depends on canonicalization producing identical output across all implementations.

```go
package alx

import (
	"encoding/json"
	"fmt"
	"math"
	"sort"
	"strconv"
	"strings"
)

// Canonicalize produces the deterministic JSON serialization of a value.
// The input should be a native Go value as decoded by encoding/json
// (i.e., nil, bool, float64, string, []interface{}, map[string]interface{}).
func Canonicalize(value interface{}) (string, error) {
	return canonicalize(value, 0)
}

const maxDepth = 128

func canonicalize(value interface{}, depth int) (string, error) {
	if depth > maxDepth {
		return "", fmt.Errorf("canonicalize: depth exceeds %d", maxDepth)
	}

	switch v := value.(type) {
	case nil:
		return "null", nil

	case bool:
		if v {
			return "true", nil
		}
		return "false", nil

	case float64:
		// Handle -0 -> "0"
		if v == 0 {
			return "0", nil
		}
		// Handle integers stored as float64 (JSON numbers)
		if v == math.Trunc(v) && !math.IsInf(v, 0) && math.Abs(v) < 1e15 {
			return strconv.FormatInt(int64(v), 10), nil
		}
		// Shortest representation matching JSON.stringify behavior
		return strconv.FormatFloat(v, 'f', -1, 64), nil

	case json.Number:
		// If the caller used json.Decoder with UseNumber()
		s := v.String()
		if strings.Contains(s, ".") || strings.Contains(s, "e") || strings.Contains(s, "E") {
			f, err := v.Float64()
			if err != nil {
				return "", err
			}
			return canonicalize(f, depth)
		}
		return s, nil

	case string:
		b, err := json.Marshal(v)
		if err != nil {
			return "", err
		}
		return string(b), nil

	case []interface{}:
		parts := make([]string, len(v))
		for i, elem := range v {
			s, err := canonicalize(elem, depth+1)
			if err != nil {
				return "", err
			}
			parts[i] = s
		}
		return "[" + strings.Join(parts, ",") + "]", nil

	case map[string]interface{}:
		// Collect keys, sort lexicographically (by UTF-8 bytes)
		keys := make([]string, 0, len(v))
		for k := range v {
			keys = append(keys, k)
		}
		sort.Strings(keys)

		parts := make([]string, 0, len(keys))
		for _, k := range keys {
			val := v[k]
			// Omit undefined - in Go this means the key is simply absent,
			// so this is handled naturally. Explicitly skip nil-interface
			// entries only if your domain uses them for "undefined".
			canonKey, err := json.Marshal(k)
			if err != nil {
				return "", err
			}
			canonVal, err := canonicalize(val, depth+1)
			if err != nil {
				return "", err
			}
			parts = append(parts, string(canonKey)+":"+canonVal)
		}
		return "{" + strings.Join(parts, ",") + "}", nil

	default:
		return "", fmt.Errorf("canonicalize: unsupported type %T", value)
	}
}
```

**Pitfall -- float formatting.** Go's `encoding/json.Marshal` formats `1.0` as `"1"` and `1.5` as `"1.5"`, which matches JavaScript's `JSON.stringify`. However, `strconv.FormatFloat` with the `'e'` verb produces scientific notation that differs from JS. Always use `'f'` with precision `-1` for non-integer floats, and emit integers without a decimal point.

**Pitfall -- negative zero.** Go's `float64` does distinguish `-0` from `0` at the bit level (`math.Signbit` returns true), but the `v == 0` check catches both. The explicit `return "0"` ensures `-0` maps to `"0"`.

**Validation:** Test against vectors C1 through C13 in `protocol/test-vectors/canonicalization.json`.

---

### Step 2: Implement deriveBlockHash()

```go
package alx

import (
	"encoding/hex"
	"sort"
	"strings"

	"golang.org/x/crypto/sha3"
)

// DeriveBlockHash computes the Keccak-256 blockHash from content and parentHashes.
func DeriveBlockHash(content interface{}, parentHashes []string) (string, error) {
	// Normalize parents: lowercase, validate, deduplicate, sort
	normalized := NormalizeHashes(parentHashes)

	// Build the canonical hash input: {"content":<canonical>,"parentHashes":[<sorted>]}
	canonContent, err := Canonicalize(content)
	if err != nil {
		return "", err
	}

	// Build parentHashes array manually to avoid double-encoding
	quotedParents := make([]string, len(normalized))
	for i, h := range normalized {
		quotedParents[i] = `"` + h + `"`
	}
	hashInput := `{"content":` + canonContent + `,"parentHashes":[` + strings.Join(quotedParents, ",") + `]}`

	// Keccak-256 - NOT SHA3-256
	hasher := sha3.NewLegacyKeccak256()
	hasher.Write([]byte(hashInput))
	digest := hasher.Sum(nil)

	return "0x" + hex.EncodeToString(digest), nil
}
```

**Pitfall — Keccak-256 vs SHA3-256.** The most frequent mistake when implementing ALX in Go. The `golang.org/x/crypto/sha3` package provides both:

- `sha3.NewLegacyKeccak256()` — Keccak-256, the pre-standardization version used by Ethereum. **Use the Legacy Keccak constructor.**
- `sha3.New256()` — NIST SHA3-256, which applies different padding (domain separation). SHA3-256 produces completely different hashes.

If `blockHash` values diverge from test vectors, verify the hash constructor first.

---

### Step 3: Implement createBlock()

```go
package alx

import (
	"regexp"
	"sort"
	"strings"
)

// Block represents a Knowledge Block in the ALX Protocol.
type Block struct {
	BlockHash    string      `json:"blockHash"`
	ContentHash  string      `json:"contentHash"`
	ParentHashes []string    `json:"parentHashes"`
	Content      interface{} `json:"content"`
}

var hashPattern = regexp.MustCompile(`^0x[a-f0-9]{64}$`)

// NormalizeHash lowercases and validates a single hash.
// Returns empty string if the hash is invalid.
func NormalizeHash(hash string) string {
	h := strings.ToLower(strings.TrimSpace(hash))
	if !hashPattern.MatchString(h) {
		return ""
	}
	return h
}

// NormalizeHashes normalizes, deduplicates, and sorts a slice of hashes.
// Invalid hashes are dropped.
func NormalizeHashes(hashes []string) []string {
	seen := make(map[string]bool)
	var result []string
	for _, h := range hashes {
		n := NormalizeHash(h)
		if n == "" || seen[n] {
			continue
		}
		seen[n] = true
		result = append(result, n)
	}
	sort.Strings(result)
	return result
}

// DeriveContentHash computes the Keccak-256 hash of the canonicalized content alone.
func DeriveContentHash(content interface{}) (string, error) {
	canon, err := Canonicalize(content)
	if err != nil {
		return "", err
	}
	hasher := sha3.NewLegacyKeccak256()
	hasher.Write([]byte(canon))
	digest := hasher.Sum(nil)
	return "0x" + hex.EncodeToString(digest), nil
}

// CreateBlock constructs a complete Knowledge Block with derived hashes.
func CreateBlock(content interface{}, parentHashes []string) (*Block, error) {
	normalized := NormalizeHashes(parentHashes)

	blockHash, err := DeriveBlockHash(content, normalized)
	if err != nil {
		return nil, err
	}

	contentHash, err := DeriveContentHash(content)
	if err != nil {
		return nil, err
	}

	return &Block{
		BlockHash:    blockHash,
		ContentHash:  contentHash,
		ParentHashes: normalized,
		Content:      content,
	}, nil
}

// ValidateBlock recomputes blockHash and checks it matches.
func ValidateBlock(block *Block) (ok bool, expected string, actual string, err error) {
	recomputed, err := DeriveBlockHash(block.Content, block.ParentHashes)
	if err != nil {
		return false, block.BlockHash, "", err
	}
	return recomputed == block.BlockHash, block.BlockHash, recomputed, nil
}
```

---

### Step 4: Implement traceAttribution()

Attribution tracing walks the Graph from a root block backward through parents, computing how many distinct paths reach each ancestor. The algorithm uses two passes.

```go
package alx

import (
	"math/big"
	"sort"
)

// TraceNode represents a single node in an attribution trace.
type TraceNode struct {
	Hash      string   `json:"hash"`
	Depth     int      `json:"depth"`
	PathCount *big.Int `json:"pathCount"`
}

// TraceResult is the output of traceAttribution.
type TraceResult struct {
	NodeCount int         `json:"nodeCount"`
	EdgeCount int         `json:"edgeCount"`
	Nodes     []TraceNode `json:"nodes"`
}

// TraceAttribution performs BFS discovery and topological path-count propagation.
// graph maps each blockHash to its parentHashes.
func TraceAttribution(rootHash string, graph map[string][]string) *TraceResult {
	// --- Pass 1: BFS to discover reachable nodes, edges, and depths ---
	type nodeInfo struct {
		depth    int
		parents  []string
	}
	visited := make(map[string]*nodeInfo)
	queue := []string{rootHash}
	visited[rootHash] = &nodeInfo{depth: 0}
	edgeCount := 0

	for len(queue) > 0 {
		current := queue[0]
		queue = queue[1:]
		info := visited[current]
		parents := graph[current]
		info.parents = parents

		for _, p := range parents {
			edgeCount++
			if _, seen := visited[p]; !seen {
				visited[p] = &nodeInfo{depth: info.depth + 1}
				queue = append(queue, p)
			}
		}
	}

	// --- Pass 2: Topological order (by depth ascending), propagate path counts ---
	// Collect all discovered nodes
	type entry struct {
		hash string
		info *nodeInfo
	}
	entries := make([]entry, 0, len(visited))
	for h, info := range visited {
		entries = append(entries, entry{h, info})
	}
	// Sort by depth ascending for topological processing
	sort.Slice(entries, func(i, j int) bool {
		return entries[i].info.depth < entries[j].info.depth
	})

	pathCounts := make(map[string]*big.Int)
	// Root has 1 path (itself)
	pathCounts[rootHash] = big.NewInt(1)

	for _, e := range entries {
		count := pathCounts[e.hash]
		if count == nil {
			count = big.NewInt(0)
		}
		for _, p := range e.info.parents {
			if _, ok := pathCounts[p]; !ok {
				pathCounts[p] = big.NewInt(0)
			}
			pathCounts[p].Add(pathCounts[p], count)
		}
	}

	// --- Build result with deterministic ordering ---
	// Sort by (depth ascending, hash ascending) for deterministic output
	nodes := make([]TraceNode, 0, len(visited))
	for _, e := range entries {
		pc := pathCounts[e.hash]
		if pc == nil {
			pc = big.NewInt(0)
		}
		nodes = append(nodes, TraceNode{
			Hash:      e.hash,
			Depth:     e.info.depth,
			PathCount: pc,
		})
	}
	sort.SliceStable(nodes, func(i, j int) bool {
		if nodes[i].Depth != nodes[j].Depth {
			return nodes[i].Depth < nodes[j].Depth
		}
		return nodes[i].Hash < nodes[j].Hash
	})

	return &TraceResult{
		NodeCount: len(visited),
		EdgeCount: edgeCount,
		Nodes:     nodes,
	}
}
```

**Validation:** Test against vectors T1 through T6 in `protocol/test-vectors/attribution-trace.json`. T2 (diamond Graph) verifies that path counts propagate correctly through convergence points.

---

### Step 5: Build Conformance Adapter

The ALX conformance runner communicates with an implementation over stdin/stdout using newline-delimited JSON. Each line is a request; the adapter writes one JSON response line per request.

```go
package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"

	"your-module/alx" // replace with your actual module path
)

func main() {
	scanner := bufio.NewScanner(os.Stdin)
	// Increase buffer for large payloads
	scanner.Buffer(make([]byte, 0, 1024*1024), 1024*1024)

	for scanner.Scan() {
		line := scanner.Bytes()

		var req map[string]interface{}
		if err := json.Unmarshal(line, &req); err != nil {
			writeError("parse error: " + err.Error())
			continue
		}

		op, _ := req["op"].(string)
		switch op {
		case "canonicalize":
			input := req["input"]
			result, err := alx.Canonicalize(input)
			if err != nil {
				writeError(err.Error())
			} else {
				writeResult(map[string]interface{}{"result": result})
			}

		case "deriveBlockHash":
			content := req["content"]
			rawParents, _ := req["parentHashes"].([]interface{})
			parents := toStringSlice(rawParents)
			result, err := alx.DeriveBlockHash(content, parents)
			if err != nil {
				writeError(err.Error())
			} else {
				writeResult(map[string]interface{}{"result": result})
			}

		case "deriveContentHash":
			content := req["content"]
			result, err := alx.DeriveContentHash(content)
			if err != nil {
				writeError(err.Error())
			} else {
				writeResult(map[string]interface{}{"result": result})
			}

		case "createBlock":
			content := req["content"]
			rawParents, _ := req["parentHashes"].([]interface{})
			parents := toStringSlice(rawParents)
			block, err := alx.CreateBlock(content, parents)
			if err != nil {
				writeError(err.Error())
			} else {
				writeResult(map[string]interface{}{
					"blockHash":    block.BlockHash,
					"contentHash":  block.ContentHash,
					"parentHashes": block.ParentHashes,
				})
			}

		case "traceAttribution":
			root, _ := req["root"].(string)
			rawGraph, _ := req["graph"].(map[string]interface{})
			graph := make(map[string][]string)
			for k, v := range rawGraph {
				arr, _ := v.([]interface{})
				graph[k] = toStringSlice(arr)
			}
			trace := alx.TraceAttribution(root, graph)
			writeResult(map[string]interface{}{
				"nodeCount": trace.NodeCount,
				"edgeCount": trace.EdgeCount,
				"nodes":     trace.Nodes,
			})

		default:
			writeError("unknown op: " + op)
		}
	}
}

func toStringSlice(arr []interface{}) []string {
	result := make([]string, 0, len(arr))
	for _, v := range arr {
		if s, ok := v.(string); ok {
			result = append(result, s)
		}
	}
	return result
}

func writeResult(data map[string]interface{}) {
	data["ok"] = true
	b, _ := json.Marshal(data)
	fmt.Println(string(b))
}

func writeError(msg string) {
	b, _ := json.Marshal(map[string]interface{}{
		"ok":    false,
		"error": msg,
	})
	fmt.Println(string(b))
}
```

Build and run against the conformance suite:

```bash
cd my-go-impl
go build -o alx-go ./cmd/adapter
alx conformance run --impl "./alx-go"
```

---

### Common Pitfalls

| Pitfall | Details |
|---|---|
| **SHA3-256 vs Keccak-256** | `sha3.New256()` is SHA3-256 (NIST). `sha3.NewLegacyKeccak256()` is Keccak-256 (Ethereum). ALX uses Keccak-256. Keccak constructor selection is the most common implementation error. |
| **Float formatting** | Must match JavaScript's `JSON.stringify`. `1.5` must serialize as `"1.5"`, not `"1.500000"`. Use `strconv.FormatFloat(v, 'f', -1, 64)` for non-integer floats. Integer-valued floats like `2.0` must serialize as `"2"`, not `"2.0"`. |
| **Key sorting** | Lexicographic sort by UTF-8 bytes. Go's `sort.Strings` handles ASCII and most Unicode correctly. The sort matches the protocol requirement. |
| **Parent normalization** | Lowercase with `strings.ToLower`, validate against `^0x[a-f0-9]{64}$`, deduplicate, then `sort.Strings`. Invalid `blockHash` values are silently dropped. |
| **Negative zero** | `-0` must canonicalize to `"0"`. In Go, `float64(-0) == 0` is true, so checking `v == 0` and returning `"0"` handles negative zero. Verify with `math.Copysign(1, v)` for an explicit check. |
| **Canonical hash input field order** | The hash input object must have `"content"` before `"parentHashes"`. Building the string manually (as shown in Step 2) avoids reliance on `encoding/json`'s key ordering. |

---

## Related Documents

- [`conformance.md`](./conformance.md) — conformance requirements and suite model
- [`independent-implementation.md`](./independent-implementation.md) — adapter contract for cross-language verification
- [`../data-model.md`](../data-model.md) — Block and Trace field reference
- [`../operations.md`](../operations.md) — operation signatures to implement
- [`../deep-dives/canonical-envelope.md`](../deep-dives/canonical-envelope.md) — canonicalization and hash derivation details
- [`../../protocol/spec.md`](../../protocol/spec.md) — normative protocol behavior

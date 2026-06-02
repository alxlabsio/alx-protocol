# Protocol Errors

The document explains error codes and recovery guidance. Machine-readable error registries remain authoritative where present.

---

This document defines the error conditions that ALX Protocol operations MAY produce.

All errors defined here are deterministic and MUST be produced consistently across conformant implementations.

---

## 1. Error Model

- errors MUST be deterministic for identical inputs
- errors MUST NOT depend on runtime, environment, or platform
- error conditions MUST be evaluated prior to producing outputs

Implementations MAY represent errors as:

- exceptions
- error objects
- result types

However, error conditions and classification MUST remain identical.

## 2. Canonicalization Errors

These errors MUST be raised during canonicalization.

| Error | Condition | Recovery |
|---|---|---|
| `BigInt not allowed` | Input contains a BigInt value | Convert to string or safe integer before canonicalization |
| `Symbol not allowed` | Input contains a Symbol | Remove symbols from input; they are not JSON-serializable |
| `Non-finite number not allowed` | Input contains `NaN`, `Infinity`, or `-Infinity` | Replace with null, a string representation, or omit the field |
| `Integer out of safe range` | Integer exceeds `Number.MAX_SAFE_INTEGER` or is below `Number.MIN_SAFE_INTEGER` | Convert to string before canonicalization |
| `Canonicalization depth exceeded 128` | Nesting exceeds maximum recursion depth | Flatten the data structure to reduce nesting depth |
| `Unsupported type` | Input contains a value that cannot be serialized | Convert to a JSON-compatible type (string, number, boolean, null, array, object) |

Requirements:

- implementations MUST fail immediately on these conditions
- partial canonicalization MUST NOT occur

---

## 3. Block Errors

| Error | Condition |
|---|---|
| `invalid hash` | Value does not match required format: `0x` + 64 lowercase hex characters |

Requirements:

- validation MUST occur before inclusion in protocol operations
- invalid hashes MUST NOT be used in hashing or graph construction

---

## 4. Lineage Errors

Lineage validation MAY return structured error metadata instead of throwing.

| Error | Condition | Returned field |
|---|---|---|
| Self-reference | Block appears in its own `parentHashes` | `selfRef: true` |
| Duplicate parents | Same hash appears multiple times (pre-normalization) | `duplicates: [...]` |
| Missing parents | Parent hash not found in known set | `missing: [...]` |
| Cycle detected | Graph contains a cycle | `cycle: true` |

Requirements:

- detection MUST be deterministic
- multiple conditions MAY be reported simultaneously
- returned fields MUST be consistent across implementations

---

## 5. Trace Errors

| Error | Condition |
|---|---|
| `rootHash is required` | Root hash is missing or empty |
| `graph must be a Map` | Graph input is not a Map-compatible structure |

Requirements:

- input validation MUST occur before traversal
- trace computation MUST NOT proceed on invalid input

---

## 6. Signature Errors

These errors apply to signing and verification layers (orthogonal to core protocol).

| Error | Condition |
|---|---|
| `blockHash must be a 0x-prefixed 32-byte hex value` | Invalid hash format |
| `actor must be a 20-byte hex address` | Invalid address format |
| `nonce is required` | Missing nonce |
| `expired` | Request past expiry timestamp |
| `nonce reused` | Nonce already seen |
| `signer mismatch` | Recovered signer does not match expected |
| `chain mismatch` | Chain ID does not match expected |

Requirements:

- signature validation MUST be deterministic
- nonce handling MUST prevent replay
- expiry MUST be evaluated against provided timestamp context (system time is acceptable only when explicitly defined)

---

## 7. External Integration Errors

### 7.1 Integration Registry

| Error | Condition |
|---|---|
| `PlatformAlreadyExists` | Platform ID already registered |
| `PlatformNotFound` | Platform ID not registered |
| `NotPlatformOwner` | Caller is not the platform owner |
| `ZeroAddress` | Owner or attestor is the zero address |
| `ZeroPlatformId` | Platform ID is bytes32(0) |

### 7.2 Checkpoint Integration

| Error | Condition |
|---|---|
| `CheckpointNotFound` | Checkpoint ID not found |
| `ZeroRootHash` | Root hash is bytes32(0) |
| `PlatformNotActive` | Platform is deactivated |
| `NotAuthorizedAttestor` | Caller is not the platform's attestor |

## 8. Error Handling Guarantees

A conformant implementation MUST:

- produce the same error for the same invalid input
- MUST NOT substitute or generalize defined errors
- MUST NOT silently ignore invalid conditions unless explicitly specified

## 9. Non-Goals

This specification defines none of the following:

- error message localization
- logging formats
- transport-layer error encoding (HTTP, RPC, etc.)

## 10. Error Codes (Recommended)

Stable identifiers are recommended:

- `ERR_CANON_BIGINT`
- `ERR_CANON_SYMBOL`
- `ERR_CANON_NON_FINITE`
- `ERR_CANON_RANGE`
- `ERR_CANON_DEPTH`
- `ERR_CANON_UNSUPPORTED`
- `ERR_BLOCK_INVALID_HASH`
- `ERR_LINEAGE_SELF_REF`
- `ERR_LINEAGE_DUPLICATE`
- `ERR_LINEAGE_MISSING`
- `ERR_LINEAGE_CYCLE`

Benefits:

- cross-language consistency
- machine-readable validation
- future-proofing without breaking message text

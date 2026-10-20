# TypeScript SDK Surface

**Document type:** Guide

This page maps the maintained `@alx-protocol/sdk` exports by responsibility. TypeScript source declarations are the package API authority; canonical protocol behavior remains governed by [`../../protocol/spec.md`](../../protocol/spec.md).

## Installation

```bash
npm install @alx-protocol/sdk
```

The package is published on npm as [`@alx-protocol/sdk`](https://www.npmjs.com/package/@alx-protocol/sdk) and requires the Node range declared in [`../../sdk/package.json`](../../sdk/package.json).

## Core root exports

Import these from `@alx-protocol/sdk`.

### Version and errors

- `ALX_PROTOCOL_VERSION`
- `ErrorCode`, `protocolError`
- `ErrorCodeValue`

### Canonicalization and raw ingress

- `canonicalizeProtocolJson(value)`
- `parseStrictJson(raw)`, `parseStrictJsonBytes(bytes)`
- `CANONICALIZATION_ALGORITHM`

`parseStrictJson*` is the raw JSON boundary. It rejects duplicate members, malformed input, and trailing data before canonicalization.

### Hash and parent utilities

- `HASH_PATTERN`, `MAX_PARENTS`
- `normalizeHash`, `normalizeHashLenient`, `normalizeHashes`
- `sanitizeImportedParentHashes`
- `compareHashesConstantTime`, `hexToBytes`, `bytesToHex`, `concatBytes`

Strict Block creation uses strict normalization. `sanitizeImportedParentHashes` returns diagnostics for an import-policy decision; it does not silently authorize a partially accepted Block.

### Block identity and validation

- `deriveBlockHash`, `deriveContentHash`
- `createBlock`, `validateBlock`, `lock`
- `Block`, `BlockValidation`, `HashValidationResult`

A v1 Block contains `blockHash`, `contentHash`, `parentHashes`, `content`, and `protocolVersion: "1"`.

### Canonical Graph verification

```ts
const result = validateGraph(seed, source, context);
```

The root exports include:

- `validateGraph`
- `GraphVerification`, `GraphValidationStatus`, `GraphValidationIssue`
- `FiniteGraphBlockSource`, `GraphBlockCandidate`, `GraphLimitReached`
- `VerificationContext`, `ValidationMode`, `ExternalParentBoundary`

`source` can use the portable finite shape:

```ts
const source = { kind: "finite", blocks };
const context = {
  protocolVersion: "1",
  validationMode: "closed-world",
  graphRoot: seed.blockHash,
};
```

The complete result has `checked: true` and a status of `valid`, `invalid`, `incomplete`, or `resource_limit_reached`.

### Lineage compatibility helpers

- `validateLineage`
- `validateGraphStructure`
- deprecated adjacency overload `validateGraph(graph, context?)`
- `buildGraph`, `verifyGraph`
- `addBlockToGraph`, `validateIncrementalBlock`
- `LineageResult`, `GraphResult`, `VerifyResult`

These helpers remain exported for SDK compatibility. New code making a canonical Graph verification claim should use the three-argument form.

### Trace

- `traceAttribution`, `verifyTrace`
- `AttributionTrace`, `TraceNode`, `TraceEdge`, `TraceVerification`

Trace accepts a root hash, prepared adjacency `Map`, and optional Trace context. It is a complete protocol structure, not a paginated Explorer response.

## Portable signing extension

The root exports include:

- `deriveAttestationDigest`
- `createSignedBlock`, `addAttestation`, `validateSignedBlock`
- `Ed25519Signer`, `Ed25519Verifier`
- `P256Signer`, `P256Verifier`
- `SignedBlock`, `AttestationValidation`

Portable extension behavior and byte encodings are defined in [`../../protocol/extensions/signing/README.md`](../../protocol/extensions/signing/README.md). Signing never changes `blockHash`.

## TypeScript application signing utilities

The SDK also exports `Eip712Signer`, `Eip712Verifier`, legacy `signBlock` and `verifyBlockSignature`, signed-request helpers, and replay-window helpers. These are TypeScript package/application capabilities, not core conformance and not part of the portable Ed25519/P-256 extension suites.

Applications own authorization, nonce persistence, expiry policy, identity binding, and replay state.

## Subpath exports

| Import | Responsibility |
|---|---|
| `@alx-protocol/sdk/hash-utils` | Hash parsing and collection helpers |
| `@alx-protocol/sdk/block` | Block identity and signed-Block helpers |
| `@alx-protocol/sdk/lineage` | Lineage and Graph APIs |
| `@alx-protocol/sdk/trace` | Trace APIs |
| `@alx-protocol/sdk/canonicalization` | Canonicalization |
| `@alx-protocol/sdk/signatures` | Legacy/application signing interfaces |
| `@alx-protocol/sdk/eip712` | EIP-712 backend |
| `@alx-protocol/sdk/ed25519` | Ed25519 backend |
| `@alx-protocol/sdk/p256` | P-256 backend |
| `@alx-protocol/sdk/merkle` | Optional Merkle extension |
| `@alx-protocol/sdk/replay` | Application replay-window helpers |
| `@alx-protocol/sdk/middleware` | Optional agent-client middleware |

The exact export list is declared in [`../../sdk/package.json`](../../sdk/package.json) and [`../../sdk/src/index.ts`](../../sdk/src/index.ts).

## Storage adapters

Persistence lives in the separate `@alx-protocol/adapters` package. It provides memory, IndexedDB, and filesystem `BlockStore` implementations. Storage changes local availability only and does not validate a Graph or create a global index.

See [`../../adapters/README.md`](../../adapters/README.md).

## Related documents

- [`typescript-sdk-quick-start.md`](./typescript-sdk-quick-start.md) — runnable integration walkthrough
- [`../operations.md`](../operations.md) — protocol/SDK/extension classification
- [`troubleshooting.md`](./troubleshooting.md) — integration failures
- [`../../sdk/README.md`](../../sdk/README.md) — package overview and conformance status

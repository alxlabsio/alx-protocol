# Security

Security properties, assumptions, and trust model for ALX Protocol. Protocol behavior remains defined by [`../../protocol/spec.md`](../../protocol/spec.md).

---

This document defines the security properties, assumptions, and trust model of ALX Protocol.

---

## 1. Trust Model

ALX Protocol is trustless at the protocol layer.

Any party can independently:

- create Blocks
- verify Block identity (recompute `blockHash`)
- validate lineage (Graph integrity)
- trace attribution (deterministic graph traversal)

No trusted third party is required for correctness.

### 1.1 Trust Boundaries

The protocol guarantees:

- deterministic identity
- structural integrity
- verifiable lineage
- reproducible attribution

Protocol verification limits (application-layer concerns):

- truthfulness of content
- semantic correctness
- real-world identity of actors
- ordering without anchoring

---

## 2. Cryptographic Assumptions

| Primitive | Usage | Assumption |
|---|---|---|
| `keccak-256` | Block identity, Merkle trees | Collision resistance (~128-bit), preimage resistance |
| `EIP-712` | Signing and attestation | ECDSA unforgeability on secp256k1 |
| Canonical JSON | Hash preimage | Deterministic, unambiguous serialization |

### 2.1 Hash Security Model

- `blockHash` and `contentHash` rely on Keccak-256
- security depends on:
  - collision resistance (no two distinct inputs produce same hash)
  - preimage resistance (cannot derive input from hash)

Implications:

- any modification to content or lineage is detectable
- identity is tamper-evident

---

## 3. Signing

Signing is orthogonal to the protocol core and provides attestation.

### 3.1 Block Attestation

`signBlock(blockHash, { signer, chainId })`

- produces an EIP-712 signature over `blockHash`
- attestations are durable (no expiry)
- timestamp is signer-provided

Important:

- attestation leaves identity unchanged
- attestation leaves lineage unchanged

### 3.2 Protocol Requests

`verifySignedProtocolPayload(payload)`

Used for ephemeral actions.

Security controls:

- nonce: prevents replay
- expiry: bounds validity window
- chain ID: prevents cross-chain replay
- actor verification: ensures signer authenticity

---

## 4. Threat Model

| Threat | Description | Mitigation |
|---|---|
| Hash collision | Two distinct inputs produce same `blockHash` | Relies on Keccak-256 collision resistance |
| Tampered content | Content modified after creation | `validateBlock` recomputes hash |
| Forged lineage | Parent references manipulated | `verifyGraph` recomputes all hashes |
| Replay attack | Signed payload reused | Nonce + expiry + chain ID |
| Backdated attestation | Signer falsifies timestamp | Use external anchors (checkpoints) for ordering |
| Unauthorized checkpoint | Malicious checkpoint submission | Contract enforces attestor authorization |
| Deactivated platform usage | Inactive platform still used | Contract enforces `isPlatformActive` |

---

## 5. Optional External Checkpoint Security

External checkpoint integrations can act as optional verification and anchoring layers. Protocol validity requires no external checkpoints.

### 5.1 Integration Registry

Only platform owner MAY:

- update attestor
- transfer ownership
- deactivate platform

### 5.2 Checkpoint Integration

Only authorized attestor MAY:

- submit checkpoints

Enforces:

- platform must be active
- root hash must be valid

### 5.3 Merkle Verification

- Merkle proofs can be verified by external checkpoint integrations
- sorted-pair hashing is used for determinism

Guarantees:

- order-independent roots
- deterministic inclusion proofs

---

## 6. Immutability

Blocks are immutable by design.

- changing `content` or `parentHashes` produces a new `blockHash`
- there is no mutation or deletion mechanism

Implications:

- history is append-only
- corrections require new Blocks

### 6.1 Supersession (Application-Level)

Replacement is expressed via new Blocks:

`Old Block -> New Block (supersedes)`

- relationship encoded in content
- enforcement is application-layer responsibility; the protocol is uninvolved

## 7. Determinism As A Security Property

Determinism is a core security guarantee.

All protocol operations MUST:

- be pure functions
- produce identical outputs for identical inputs
- be independent of:
  - time
  - randomness
  - environment
  - platform

Security implications:

- no hidden state
- no ambiguity in verification
- no attack surface via execution differences

## 8. Limitations And Non-Goals

ALX provides no protection against:

- malicious or false content
- sybil identities (multiple identities by one actor)
- economic attacks or incentives
- off-chain data availability issues

These must be addressed at higher layers.

### Sensitive Data In Content

ALX inspects, filters, and classifies no content. The protocol has no mechanism to prevent a Block from containing a social security number, a credit card number, health records, or other regulated data.

Content governance is an application-layer responsibility. Regulated deployments must apply DLP scanning, data classification, and consent verification before calling `createBlock`. Once a Block is sealed, the content is bound to the Block identity. The sealed content cannot be removed from the Block without changing the `blockHash` and invalidating the Block.

See [`docs/trust-model.md`](../trust-model.md) and [`docs/integrators/deployment-checklist.md`](../integrators/deployment-checklist.md) for application-layer responsibilities.

---

## 9. Vulnerability Reporting

Report vulnerabilities to:

`security@xandrlabs.ai`

Include:

- description of the issue
- reproduction steps
- impact assessment
- suggested mitigation (if available)

## 10. Security Properties Matrix

| Property | Mechanism |
|---|---|
| Tamper detection | Keccak-256 hashing |
| Replay protection | Nonce + expiry |
| Graph integrity | Graph validation |
| Attribution integrity | Deterministic traversal |

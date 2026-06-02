# ALX Protocol Python Reference Implementation

The Python implementation provides ALX core protocol behavior for Python, AI, and data workflows.

It is a peer reference implementation. It does not define protocol truth. Protocol truth is defined by `protocol/spec.md`, `protocol/schemas/`, `protocol/test-vectors/`, and the machine-readable verifier files in `protocol/`.

## Capability Status

| Capability | Status |
|---|---|
| Canonicalization | Supported |
| Block creation | Supported |
| Block validation | Supported |
| Content hash derivation | Supported |
| Block hash derivation | Supported |
| Parent lineage validation | Supported |
| Trace generation | Supported |
| Verification context | Supported |
| Merkle extension helpers | Supported |
| Ed25519 signing | Supported |
| P-256 signing | Supported |
| EIP-712 signing | Not bundled |

EIP-712 is an optional Ethereum-compatible signing suite. It is not required for core protocol conformance.

## Install for Development

```bash
cd reference-implementations/python
python -m venv .venv
.venv\Scripts\activate
pip install -e ".[dev]"
```

On macOS or Linux:

```bash
source .venv/bin/activate
```

## Run Tests

```bash
pytest tests/
```

## Conformance Adapter

The Python conformance adapter is:

```text
reference-implementations/python/conformance_adapter.py
```

From the repository root:

```bash
node conformance/bin/run.js --impl "python reference-implementations/python/conformance_adapter.py"
```

## Package Layout

| Path | Purpose |
|---|---|
| `src/alx_protocol/block.py` | Block creation and validation |
| `src/alx_protocol/canonical.py` | Canonicalization |
| `src/alx_protocol/lineage.py` | Graph and lineage validation |
| `src/alx_protocol/trace.py` | Attribution Trace generation and verification |
| `src/alx_protocol/verification_context.py` | Closed-world and open-world validation context |
| `src/alx_protocol/signatures.py` | Signing model |
| `src/alx_protocol/ed25519.py` | Ed25519 backend |
| `src/alx_protocol/p256.py` | P-256 backend |
| `tests/` | Python test suite |

## Related Documents

- [`../../protocol/spec.md`](../../protocol/spec.md)
- [`../../protocol/test-vectors/`](../../protocol/test-vectors/)
- [`../PARITY.md`](../PARITY.md)
- [`../../docs/implementers/conformance.md`](../../docs/implementers/conformance.md)

# ALX Protocol Python Reference Implementation

The Python implementation provides ALX core protocol behavior for Python, AI, and data workflows.

It is a peer reference implementation. It does not define protocol truth. Protocol truth is defined by `protocol/spec.md`, `protocol/schemas/`, `test-vectors/`, and `protocol/error-codes.json`.

## Capability Status

| Capability | Status |
|---|---|
| Canonicalization | Supported |
| Block creation | Supported |
| Block validation | Supported |
| Content hash derivation | Supported |
| Block hash derivation | Supported |
| Parent lineage validation | Supported |
| Canonical Graph verification | Supported |
| Trace generation | Supported |
| Verification context | Supported |
| Merkle extension helpers | Supported |
| Ed25519 signing | Supported |
| P-256 signing | Supported |
| EIP-712 signing | Not bundled |

EIP-712 is an optional Ethereum-compatible signing suite. It is not required for core protocol conformance.

## Install

```bash
pip install alx-protocol
```

Requires Python 3.11 or later. The distribution is [`alx-protocol` on PyPI](https://pypi.org/project/alx-protocol/); the import name is `alx_protocol`.

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

## Protocol conformance adapter

The Python conformance adapter is:

```text
reference-implementations/python/conformance_adapter.py
```

From the repository root:

```bash
node conformance/bin/run.js --impl "python reference-implementations/python/conformance_adapter.py"
```

## Canonical Graph verification

`validate_graph(seed, source, context)` verifies the reachable Block Graph and returns one of `valid`, `invalid`, `incomplete`, or `resource_limit_reached`. The result is scoped to the supplied verification context and exactly follows the canonical Graph verification envelope.

The older two-argument `validate_graph(graph, context)` adjacency form remains available for compatibility. New integrations should use the canonical three-argument operation.

## Package Layout

| Path | Purpose |
|---|---|
| `src/alx_protocol/block.py` | Block creation and validation |
| `src/alx_protocol/canonical.py` | Canonicalization |
| `src/alx_protocol/lineage.py` | Graph and lineage validation |
| `src/alx_protocol/graph_validation.py` | Canonical finite-source Graph verification |
| `src/alx_protocol/trace.py` | Attribution Trace generation and verification |
| `src/alx_protocol/verification_context.py` | Closed-world and open-world validation context |
| `src/alx_protocol/signatures.py` | Signing model |
| `src/alx_protocol/ed25519.py` | Ed25519 backend |
| `src/alx_protocol/p256.py` | P-256 backend |
| `tests/` | Python test suite |

## Related Documents

- [`../../protocol/spec.md`](../../protocol/spec.md)
- [`../../test-vectors/`](../../test-vectors/)
- [`../PARITY.md`](../PARITY.md)
- [`../../docs/implementers/conformance.md`](../../docs/implementers/conformance.md)

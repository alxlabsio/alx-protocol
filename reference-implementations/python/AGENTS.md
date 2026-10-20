# Python Reference Implementation Guide

The root and parent reference-implementation guides remain applicable. This guide governs the Python package in this directory.

## Local rules

- Support Python 3.11 or newer as declared in `pyproject.toml`.
- Preserve strict raw-byte/JSON handling before ALX value construction.
- Do not use Python's `hashlib.sha3_256`; ALX identity requires legacy Keccak-256 through the declared dependency.
- Reject Python-only values that are not ALX values, including unsupported integers, non-finite floats, bytes, tuples, sets, and custom objects unless an explicit adapter converts them first.
- Preserve insertion-order independence and UTF-16 code-unit key ordering rather than Python's default string ordering where they differ.
- Use Python arbitrary-precision integers for Trace path counts and serialize them canonically.
- Keep dictionary copies and input mutation behavior consistent with the public API.

## Verification

From the repository root:

```bash
python -m pytest reference-implementations/python/tests
python -m ruff check reference-implementations/python
pnpm run test:conformance:python
```

Run `pnpm run verify:cross-language` for protocol-visible changes and the applicable extension runner for signing/Merkle work.

## Stop and report

Stop if Python cannot reproduce a canonical byte/result exactly or if a parser/dependency would silently coerce invalid input. Report Python/API compatibility, native tests, portable conformance, skips, and dependency impact.

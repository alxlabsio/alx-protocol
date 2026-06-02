#!/usr/bin/env python3
"""
ALX Protocol Conformance Adapter — Python Reference Implementation

Exposes the Python reference implementation via the standard conformance
interface (stdin/stdout JSON protocol).

Usage:
    echo '{"operation":"canonicalize","input":{"b":2,"a":1}}' | python conformance_adapter.py

Reads one JSON operation per line from stdin, executes it,
writes one JSON result per line to stdout.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from alx_protocol import (
    canonicalize,
    derive_block_hash,
    derive_content_hash,
    create_block,
    validate_block,
    validate_signed_block,
    normalize_hashes,
    trace_attribution,
    validate_graph,
    validate_incremental_block,
    verify_graph,
    verify_trace,
    Ed25519Verifier,
    P256Verifier,
)
from alx_protocol.extensions import build_merkle_tree, verify_merkle_proof


def handle(op: dict) -> dict:
    operation = op.get("operation")
    inp = op.get("input")

    if operation == "canonicalize":
        return {"output": canonicalize(inp)}

    elif operation == "canonicalizeGeneratedDepth":
        value = inp.get("leaf")
        for _ in range(inp.get("generatedDepth", 0)):
            value = {"nested": value}
        return {"output": canonicalize(value)}

    elif operation == "deriveBlockHash":
        result = derive_block_hash(inp.get("content"), inp.get("parentHashes", []))
        return {"output": result}

    elif operation == "deriveContentHash":
        result = derive_content_hash(inp.get("content"))
        return {"output": result}

    elif operation == "createBlock":
        block = create_block(inp.get("content"), inp.get("parentHashes", []))
        return {"output": block}

    elif operation == "validateBlock":
        result = validate_block(inp)
        return {"output": result}

    elif operation == "normalizeHashes":
        result = normalize_hashes(inp)
        return {"output": result}

    elif operation == "validateSignedBlockFixture":
        class FixtureVerifier:
            algorithm = "fixture"

            def verify(self, data: bytes, signature: str, expected_signer: str | None = None) -> dict:
                signer = signature.split(":", 1)[0]
                ok = signature == f"{signer}:{data.hex()}" and (expected_signer is None or expected_signer == signer)
                return {"ok": ok, "signer": signer}

        return {"output": validate_signed_block(inp, FixtureVerifier())}

    elif operation == "validatePortableSignedBlock":
        algorithm = (inp.get("attestation") or {}).get("algorithm")
        if algorithm == "ed25519":
            verifier = Ed25519Verifier()
        elif algorithm == "p256":
            verifier = P256Verifier()
        else:
            return {"error": f"Unsupported portable signing algorithm: {algorithm}"}
        return {"output": validate_signed_block(inp, verifier)}

    elif operation == "traceAttribution":
        graph = inp.get("graph", {})
        root_hash = inp.get("rootHash")
        trace = trace_attribution(root_hash, graph, inp.get("context"))
        return {"output": trace}

    elif operation == "validateGraph":
        return {"output": validate_graph(inp.get("graph", {}), inp.get("context"))}

    elif operation == "validateIncrementalBlock":
        return {"output": validate_incremental_block(inp.get("block", {}), inp.get("existingGraph", {}), inp.get("context"))}

    elif operation == "verifyTrace":
        return {"output": verify_trace(inp.get("trace", {}), inp.get("graph", {}), inp.get("context"))}

    elif operation == "verifyGraph":
        return {"output": verify_graph(inp.get("blocks", []), derive_block_hash)}

    elif operation == "buildMerkleTree":
        return {"output": build_merkle_tree(inp.get("leaves", []))}

    elif operation == "verifyMerkleProof":
        return {"output": verify_merkle_proof(inp.get("root"), inp.get("leaf"), inp.get("proof", []))}

    else:
        return {"error": f"Unknown operation: {operation}"}


def main() -> None:
    # Ensure UTF-8 for stdin/stdout (Windows defaults to cp1252)
    sys.stdin.reconfigure(encoding="utf-8")
    sys.stdout.reconfigure(encoding="utf-8")

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            op = json.loads(line)
            result = handle(op)
            print(json.dumps(result, ensure_ascii=False), flush=True)
        except Exception as e:
            print(json.dumps({"error": str(e)}), flush=True)


if __name__ == "__main__":
    main()

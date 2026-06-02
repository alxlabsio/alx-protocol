"""
Verification receipt types and construction for ALX Protocol.

A verification receipt records the result of verifying a Block graph at a point in time.
The receipt is not part of Block identity and does not change blockHash or contentHash.
"""

import re
import time
from typing import Optional

_HASH_PATTERN = re.compile(r"^0x[a-f0-9]{64}$")
_ERROR_CODE_PATTERN = re.compile(r"^ALX_[A-Z0-9_]+$")


def build_receipt(
    root: str,
    validation_mode: str,
    ok: bool,
    complete: bool,
    block_count: int,
    edge_count: int,
    *,
    external_parents: Optional[list] = None,
    missing_parents: Optional[list] = None,
    errors: Optional[list] = None,
    warnings: Optional[list] = None,
    verifier_name: str = "alx",
    verifier_version: str = "1.0.0",
    verified_at: Optional[int] = None,
    trace_hash: Optional[str] = None,
) -> dict:
    """
    Build a verification receipt dict from verification results.

    Schema constraints enforced:
    - ok=false requires at least one error entry.
    - ok=true with closed-world validation requires complete=true.
    - Non-empty externalParents requires complete=false.
    """
    ext = list(external_parents or [])
    mis = list(missing_parents or [])
    errs = list(errors or [])
    warns = list(warnings or [])

    if verified_at is None:
        verified_at = int(time.time())

    receipt: dict = {
        "receiptVersion": "1",
        "protocolVersion": "1",
        "verifiedAt": verified_at,
        "verifier": {"name": verifier_name, "version": verifier_version},
        "root": root,
        "validationMode": validation_mode,
        "ok": ok,
        "complete": complete,
        "blockCount": block_count,
        "edgeCount": edge_count,
        "externalParents": ext,
        "missingParents": mis,
        "errors": errs,
        "warnings": warns,
    }
    if trace_hash is not None:
        receipt["traceHash"] = trace_hash
    return receipt


def validate_receipt(receipt: dict) -> dict:
    """
    Validate a receipt dict against schema constraints.

    Returns {"ok": bool, "errors": list[str]}.
    """
    problems: list[str] = []

    required_fields = [
        "receiptVersion", "protocolVersion", "verifiedAt", "verifier",
        "root", "validationMode", "ok", "complete",
        "blockCount", "edgeCount", "externalParents", "missingParents",
        "errors", "warnings",
    ]
    missing = [f for f in required_fields if f not in receipt]
    if missing:
        for f in missing:
            problems.append(f"missing required field: {f}")
        return {"ok": False, "errors": problems}

    if receipt["receiptVersion"] != "1":
        problems.append("receiptVersion must be '1'")

    if receipt["protocolVersion"] != "1":
        problems.append("protocolVersion must be '1'")

    if not isinstance(receipt["verifiedAt"], int) or receipt["verifiedAt"] < 0:
        problems.append("verifiedAt must be a non-negative integer (Unix seconds)")

    verifier = receipt.get("verifier")
    if not isinstance(verifier, dict) or not verifier.get("name") or not verifier.get("version"):
        problems.append("verifier must be an object with name and version strings")

    root = receipt.get("root", "")
    if not isinstance(root, str) or not _HASH_PATTERN.match(root):
        problems.append("root must match ^0x[a-f0-9]{64}$")

    if receipt["validationMode"] not in ("closed-world", "open-world"):
        problems.append("validationMode must be 'closed-world' or 'open-world'")

    if not isinstance(receipt["blockCount"], int) or receipt["blockCount"] < 0:
        problems.append("blockCount must be a non-negative integer")

    if not isinstance(receipt["edgeCount"], int) or receipt["edgeCount"] < 0:
        problems.append("edgeCount must be a non-negative integer")

    # Schema allOf constraint 1: ok=false requires at least one error
    if receipt["ok"] is False and len(receipt.get("errors") or []) == 0:
        problems.append("ok=false requires at least one entry in errors")

    # Schema allOf constraint 2: ok=true + closed-world requires complete=true
    if (
        receipt["ok"] is True
        and receipt["validationMode"] == "closed-world"
        and receipt.get("complete") is not True
    ):
        problems.append("closed-world ok=true requires complete=true")

    # Schema allOf constraint 3: non-empty externalParents requires complete=false
    if receipt.get("externalParents") and receipt.get("complete") is True:
        problems.append("complete must be false when externalParents is non-empty")

    # Validate traceHash if present
    trace_hash = receipt.get("traceHash")
    if trace_hash is not None:
        if not isinstance(trace_hash, str) or not _HASH_PATTERN.match(trace_hash):
            problems.append("traceHash must match ^0x[a-f0-9]{64}$")

    return {"ok": len(problems) == 0, "errors": problems}

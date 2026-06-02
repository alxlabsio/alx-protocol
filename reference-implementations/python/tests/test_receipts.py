"""Tests for verification receipt construction and validation."""

import time
import pytest
from alx_protocol import build_receipt, validate_receipt

ROOT = "0x" + "a" * 64
EXTERNAL = "0x" + "b" * 64


# ---------------------------------------------------------------------------
# build_receipt
# ---------------------------------------------------------------------------


def test_build_closed_world_complete():
    r = build_receipt(
        root=ROOT,
        validation_mode="closed-world",
        ok=True,
        complete=True,
        block_count=2,
        edge_count=1,
        verified_at=1710000000,
    )
    assert r["receiptVersion"] == "1"
    assert r["protocolVersion"] == "1"
    assert r["verifiedAt"] == 1710000000
    assert r["verifier"] == {"name": "alx", "version": "1.0.0"}
    assert r["root"] == ROOT
    assert r["validationMode"] == "closed-world"
    assert r["ok"] is True
    assert r["complete"] is True
    assert r["blockCount"] == 2
    assert r["edgeCount"] == 1
    assert r["externalParents"] == []
    assert r["missingParents"] == []
    assert r["errors"] == []
    assert r["warnings"] == []
    assert "traceHash" not in r


def test_build_open_world_partial():
    r = build_receipt(
        root=ROOT,
        validation_mode="open-world",
        ok=True,
        complete=False,
        block_count=2,
        edge_count=2,
        external_parents=[EXTERNAL],
        warnings=[{"code": "ALX_PARTIAL_OPEN_WORLD_TRACE", "message": "Open-world partial."}],
        verified_at=1710000000,
    )
    assert r["validationMode"] == "open-world"
    assert r["complete"] is False
    assert r["externalParents"] == [EXTERNAL]
    assert len(r["warnings"]) == 1


def test_build_failed_receipt():
    r = build_receipt(
        root=ROOT,
        validation_mode="closed-world",
        ok=False,
        complete=False,
        block_count=1,
        edge_count=0,
        errors=[{"code": "ALX_BLOCK_HASH_MISMATCH", "message": "Hash mismatch."}],
        verified_at=1710000000,
    )
    assert r["ok"] is False
    assert len(r["errors"]) == 1


def test_build_with_trace_hash():
    th = "0x" + "c" * 64
    r = build_receipt(
        root=ROOT,
        validation_mode="closed-world",
        ok=True,
        complete=True,
        block_count=1,
        edge_count=0,
        trace_hash=th,
        verified_at=1710000000,
    )
    assert r["traceHash"] == th


def test_build_defaults_verified_at():
    before = int(time.time())
    r = build_receipt(
        root=ROOT,
        validation_mode="closed-world",
        ok=True,
        complete=True,
        block_count=1,
        edge_count=0,
    )
    after = int(time.time())
    assert before <= r["verifiedAt"] <= after


def test_build_custom_verifier():
    r = build_receipt(
        root=ROOT,
        validation_mode="closed-world",
        ok=True,
        complete=True,
        block_count=1,
        edge_count=0,
        verifier_name="my-verifier",
        verifier_version="2.3.1",
        verified_at=1710000000,
    )
    assert r["verifier"]["name"] == "my-verifier"
    assert r["verifier"]["version"] == "2.3.1"


# ---------------------------------------------------------------------------
# validate_receipt — valid cases
# ---------------------------------------------------------------------------


def test_validate_closed_world_complete():
    r = build_receipt(
        root=ROOT, validation_mode="closed-world", ok=True, complete=True,
        block_count=2, edge_count=1, verified_at=1710000000,
    )
    result = validate_receipt(r)
    assert result["ok"] is True
    assert result["errors"] == []


def test_validate_open_world_partial():
    r = build_receipt(
        root=ROOT, validation_mode="open-world", ok=True, complete=False,
        block_count=2, edge_count=2, external_parents=[EXTERNAL],
        verified_at=1710000000,
    )
    result = validate_receipt(r)
    assert result["ok"] is True


def test_validate_failed_with_errors():
    r = build_receipt(
        root=ROOT, validation_mode="closed-world", ok=False, complete=False,
        block_count=1, edge_count=0,
        errors=[{"code": "ALX_BLOCK_HASH_MISMATCH", "message": "x"}],
        verified_at=1710000000,
    )
    result = validate_receipt(r)
    assert result["ok"] is True


# ---------------------------------------------------------------------------
# validate_receipt — schema constraint violations
# ---------------------------------------------------------------------------


def test_validate_rejects_ok_false_without_errors():
    r = build_receipt(
        root=ROOT, validation_mode="closed-world", ok=False, complete=False,
        block_count=1, edge_count=0, verified_at=1710000000,
    )
    # errors list is empty — violates constraint
    result = validate_receipt(r)
    assert result["ok"] is False
    assert any("errors" in e for e in result["errors"])


def test_validate_rejects_closed_world_ok_true_incomplete():
    r = build_receipt(
        root=ROOT, validation_mode="closed-world", ok=True, complete=False,
        block_count=1, edge_count=0, verified_at=1710000000,
    )
    result = validate_receipt(r)
    assert result["ok"] is False
    assert any("complete" in e for e in result["errors"])


def test_validate_rejects_complete_true_with_external_parents():
    r = build_receipt(
        root=ROOT, validation_mode="open-world", ok=True, complete=True,
        block_count=2, edge_count=1, external_parents=[EXTERNAL],
        verified_at=1710000000,
    )
    result = validate_receipt(r)
    assert result["ok"] is False
    assert any("externalParents" in e or "complete" in e for e in result["errors"])


def test_validate_rejects_bad_root():
    r = build_receipt(
        root="not-a-hash", validation_mode="closed-world", ok=True, complete=True,
        block_count=1, edge_count=0, verified_at=1710000000,
    )
    result = validate_receipt(r)
    assert result["ok"] is False
    assert any("root" in e for e in result["errors"])


def test_validate_rejects_bad_validation_mode():
    r = build_receipt(
        root=ROOT, validation_mode="unknown-mode", ok=True, complete=True,
        block_count=1, edge_count=0, verified_at=1710000000,
    )
    result = validate_receipt(r)
    assert result["ok"] is False


def test_validate_rejects_missing_field():
    r = build_receipt(
        root=ROOT, validation_mode="closed-world", ok=True, complete=True,
        block_count=1, edge_count=0, verified_at=1710000000,
    )
    del r["blockCount"]
    result = validate_receipt(r)
    assert result["ok"] is False
    assert any("blockCount" in e for e in result["errors"])


def test_validate_rejects_wrong_receipt_version():
    r = build_receipt(
        root=ROOT, validation_mode="closed-world", ok=True, complete=True,
        block_count=1, edge_count=0, verified_at=1710000000,
    )
    r["receiptVersion"] = "2"
    result = validate_receipt(r)
    assert result["ok"] is False


def test_validate_rejects_bad_trace_hash():
    r = build_receipt(
        root=ROOT, validation_mode="closed-world", ok=True, complete=True,
        block_count=1, edge_count=0, trace_hash="not-a-hash",
        verified_at=1710000000,
    )
    result = validate_receipt(r)
    assert result["ok"] is False

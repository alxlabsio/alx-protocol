"""Concrete signing backend tests for Python reference implementation."""

from alx_protocol import (
    Ed25519Signer,
    Ed25519Verifier,
    P256Signer,
    P256Verifier,
    create_signed_block,
    validate_signed_block,
)


def test_ed25519_round_trip_signed_block():
    signer = Ed25519Signer("0x" + "01" * 32)
    verifier = Ed25519Verifier()
    signed = create_signed_block({"workflow": "security-review", "decision": "approve"}, [], signer, timestamp=1)
    result = validate_signed_block(signed, verifier)
    assert signed["attestation"]["algorithm"] == "ed25519"
    assert result["ok"] is True


def test_ed25519_rejects_tampered_signature():
    signer = Ed25519Signer("0x" + "02" * 32)
    verifier = Ed25519Verifier()
    signed = create_signed_block({"workflow": "research-synthesis"}, [], signer, timestamp=1)
    signed["attestation"]["signature"] = signed["attestation"]["signature"][:-2] + "ff"
    signed["attestations"][0]["signature"] = signed["attestation"]["signature"]
    assert validate_signed_block(signed, verifier)["ok"] is False


def test_p256_round_trip_signed_block():
    signer = P256Signer("0x" + "03" * 32)
    verifier = P256Verifier()
    signed = create_signed_block({"workflow": "model-release", "decision": "staged"}, [], signer, timestamp=1)
    result = validate_signed_block(signed, verifier)
    assert signed["attestation"]["algorithm"] == "p256"
    assert result["ok"] is True


def test_p256_rejects_tampered_signature():
    signer = P256Signer("0x" + "04" * 32)
    verifier = P256Verifier()
    signed = create_signed_block({"workflow": "compliance-audit"}, [], signer, timestamp=1)
    signed["attestation"]["signature"] = signed["attestation"]["signature"][:-2] + "ff"
    signed["attestations"][0]["signature"] = signed["attestation"]["signature"]
    assert validate_signed_block(signed, verifier)["ok"] is False

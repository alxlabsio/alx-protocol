"""Ed25519 signer and verifier backends for ALX Block attestations."""

from __future__ import annotations

import re

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import (
    Ed25519PrivateKey,
    Ed25519PublicKey,
)

ED25519_PUBLIC_RE = re.compile(r"^0x[a-f0-9]{64}$")
ED25519_SIGNATURE_RE = re.compile(r"^0x[a-f0-9]{128}$")


def _hex_to_bytes(value: str) -> bytes:
    clean = value[2:] if value.startswith("0x") else value
    return bytes.fromhex(clean)


def _bytes_to_hex(value: bytes) -> str:
    return "0x" + value.hex()


class Ed25519Signer:
    algorithm = "ed25519"

    def __init__(self, private_key: bytes | str):
        raw = _hex_to_bytes(private_key) if isinstance(private_key, str) else private_key
        if len(raw) != 32:
            raise ValueError("Ed25519 private key must be exactly 32 bytes")
        self._private_key = Ed25519PrivateKey.from_private_bytes(raw)

    def get_id(self) -> str:
        public_key = self._private_key.public_key().public_bytes(
            encoding=serialization.Encoding.Raw,
            format=serialization.PublicFormat.Raw,
        )
        return _bytes_to_hex(public_key)

    def sign(self, data: bytes) -> str:
        if len(data) != 32:
            raise ValueError("Ed25519 attestation input must be a 32-byte digest")
        return _bytes_to_hex(self._private_key.sign(data))


class Ed25519Verifier:
    algorithm = "ed25519"

    def verify(self, data: bytes, signature: str, expected_signer: str | None = None) -> dict:
        if not expected_signer:
            return {"ok": False, "signer": ""}
        if len(data) != 32 or not ED25519_PUBLIC_RE.fullmatch(expected_signer) or not ED25519_SIGNATURE_RE.fullmatch(signature):
            return {"ok": False, "signer": expected_signer}
        try:
            public_key = Ed25519PublicKey.from_public_bytes(_hex_to_bytes(expected_signer))
            public_key.verify(_hex_to_bytes(signature), data)
            return {"ok": True, "signer": expected_signer}
        except Exception:
            return {"ok": False, "signer": expected_signer}

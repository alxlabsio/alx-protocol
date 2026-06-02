"""P-256 signer and verifier backends for ALX Block attestations."""

from __future__ import annotations

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.utils import Prehashed, decode_dss_signature, encode_dss_signature


def _hex_to_bytes(value: str) -> bytes:
    clean = value[2:] if value.startswith("0x") else value
    return bytes.fromhex(clean)


def _bytes_to_hex(value: bytes) -> str:
    return "0x" + value.hex()


class P256Signer:
    algorithm = "p256"

    def __init__(self, private_key: bytes | str):
        raw = _hex_to_bytes(private_key) if isinstance(private_key, str) else private_key
        if len(raw) != 32:
            raise ValueError("P-256 private key must be exactly 32 bytes")
        scalar = int.from_bytes(raw, "big")
        if scalar <= 0:
            raise ValueError("P-256 private key scalar must be positive")
        self._private_key = ec.derive_private_key(scalar, ec.SECP256R1())

    def get_id(self) -> str:
        public_key = self._private_key.public_key().public_bytes(
            encoding=serialization.Encoding.X962,
            format=serialization.PublicFormat.UncompressedPoint,
        )
        return _bytes_to_hex(public_key)

    def sign(self, data: bytes) -> str:
        if len(data) != 32:
            raise ValueError("P-256 attestation input must be a 32-byte digest")
        der = self._private_key.sign(data, ec.ECDSA(Prehashed(hashes.SHA256())))
        r, s = decode_dss_signature(der)
        return _bytes_to_hex(r.to_bytes(32, "big") + s.to_bytes(32, "big"))


class P256Verifier:
    algorithm = "p256"

    def verify(self, data: bytes, signature: str, expected_signer: str | None = None) -> dict:
        if not expected_signer:
            return {"ok": False, "signer": ""}
        try:
            public_key = ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256R1(), _hex_to_bytes(expected_signer))
            compact = _hex_to_bytes(signature)
            if len(compact) != 64:
                return {"ok": False, "signer": expected_signer}
            if len(data) != 32:
                return {"ok": False, "signer": expected_signer}
            r = int.from_bytes(compact[:32], "big")
            s = int.from_bytes(compact[32:], "big")
            public_key.verify(encode_dss_signature(r, s), data, ec.ECDSA(Prehashed(hashes.SHA256())))
            return {"ok": True, "signer": expected_signer}
        except Exception:
            return {"ok": False, "signer": expected_signer}

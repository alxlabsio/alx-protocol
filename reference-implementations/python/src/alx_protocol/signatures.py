"""ALX Protocol — algorithm-agnostic signing interfaces."""

from dataclasses import dataclass
from typing import Protocol


class Signer(Protocol):
    algorithm: str

    def get_id(self) -> str: ...

    def sign(self, data: bytes) -> str: ...


class Verifier(Protocol):
    algorithm: str

    def verify(self, data: bytes, signature: str, expected_signer: str | None = None) -> dict: ...


@dataclass
class BlockAttestation:
    blockHash: str
    attester: str
    algorithm: str
    timestamp: int
    signature: str

    def to_dict(self) -> dict:
        return {
            "blockHash": self.blockHash,
            "attester": self.attester,
            "algorithm": self.algorithm,
            "timestamp": self.timestamp,
            "signature": self.signature,
        }

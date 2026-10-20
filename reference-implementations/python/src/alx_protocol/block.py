"""ALX Protocol — Block primitive."""

import re
import time
from typing import Any, Dict, List, Optional

from eth_hash.auto import keccak

from alx_protocol.canonical import canonicalize
from alx_protocol.signatures import BlockAttestation, Signer, Verifier

HASH_PATTERN = re.compile(r"^0x[a-f0-9]{64}$")
MAX_PARENTS = 256
CONTENT_HASH_DOMAIN = b"ALX-CONTENT-V1\x00"
BLOCK_HASH_DOMAIN = b"ALX-BLOCK-V1\x00"
ATTESTATION_HASH_DOMAIN = b"ALX-ATTESTATION-V1\x00"
_OMITTED_PARENT_HASHES = object()


def derive_block_hash(content: Any, parent_hashes: Any = _OMITTED_PARENT_HASHES) -> str:
    parents = normalize_hashes(parent_hashes)
    canonical = canonicalize({"content": content, "parentHashes": parents})
    return "0x" + keccak(BLOCK_HASH_DOMAIN + canonical.encode("utf-8")).hex()


def derive_content_hash(content: Any) -> str:
    canonical = canonicalize(content)
    return "0x" + keccak(CONTENT_HASH_DOMAIN + canonical.encode("utf-8")).hex()


def derive_attestation_digest(block_hash: str, attester: str, algorithm: str, timestamp: int) -> bytes:
    canonical = canonicalize({
        "algorithm": algorithm,
        "attester": attester,
        "blockHash": normalize_hash(block_hash),
        "timestamp": timestamp,
    })
    return keccak(ATTESTATION_HASH_DOMAIN + canonical.encode("utf-8"))


def create_block(content: Any, parent_hashes: Any = _OMITTED_PARENT_HASHES) -> Dict[str, Any]:
    parents = normalize_hashes(parent_hashes)
    return {
        "blockHash": derive_block_hash(content, parents),
        "contentHash": derive_content_hash(content),
        "parentHashes": parents,
        "content": content,
        "protocolVersion": "1",
    }


def _build_attestation(block_hash: str, signer: Signer, timestamp: int | None = None) -> dict:
    if not isinstance(getattr(signer, "algorithm", None), str) or not signer.algorithm:
        raise ValueError("signer.algorithm must be a non-empty string")
    ts = int(time.time()) if timestamp is None else timestamp
    if not isinstance(ts, int) or isinstance(ts, bool) or ts < 0 or ts > 2**53 - 1:
        raise ValueError("timestamp must be a non-negative safe integer")
    attester = signer.get_id()
    if not isinstance(attester, str) or not attester:
        raise ValueError("signer identifier must be a non-empty string")
    digest = derive_attestation_digest(block_hash, attester, signer.algorithm, ts)
    att = BlockAttestation(block_hash, attester, signer.algorithm, ts, signer.sign(digest))
    return att.to_dict()


def create_signed_block(content: Any, parent_hashes: Optional[List[str]], signer: Signer, timestamp: int | None = None) -> Dict[str, Any]:
    block = create_block(content, parent_hashes)
    att = _build_attestation(block["blockHash"], signer, timestamp)
    return {"block": block, "attestation": att, "attestations": [att]}


def add_attestation(signed_block: Dict[str, Any], signer: Signer, timestamp: int | None = None) -> Dict[str, Any]:
    att = _build_attestation(signed_block["block"]["blockHash"], signer, timestamp)
    existing = signed_block.get("attestations") or ([signed_block["attestation"]] if signed_block.get("attestation") else [])
    attestations = [*existing, att]
    return {**signed_block, "attestation": attestations[0], "attestations": attestations}


def validate_block(block: Dict[str, Any]) -> Dict[str, Any]:
    required_fields = {"blockHash", "contentHash", "parentHashes", "content", "protocolVersion"}
    if type(block) is not dict or set(block) != required_fields:
        raise ValueError("[ALX_SCHEMA_INVALID] Block fields do not match the core Block schema")
    if (
        not isinstance(block["blockHash"], str)
        or not isinstance(block["contentHash"], str)
        or not isinstance(block["parentHashes"], list)
        or not isinstance(block["protocolVersion"], str)
    ):
        raise ValueError("[ALX_SCHEMA_INVALID] Block fields do not match the core Block schema")
    version = block.get("protocolVersion")
    if version != "1":
        raise ValueError(f"[ALX_UNSUPPORTED_VERSION] Unsupported protocolVersion: \"{version}\". Only \"1\" is recognized.")
    parent_hashes = block["parentHashes"] if "parentHashes" in block else _OMITTED_PARENT_HASHES
    canonical_parents = normalize_hashes(parent_hashes)
    expected = derive_block_hash(block.get("content"), parent_hashes)
    actual = normalize_hash(block["blockHash"])
    expected_content_hash = derive_content_hash(block.get("content"))
    actual_content_hash = normalize_hash(block["contentHash"])
    parents_canonical = block.get("parentHashes", []) == canonical_parents
    self_ref = actual in canonical_parents
    ok = (
        expected == actual
        and block["blockHash"] == actual
        and expected_content_hash == actual_content_hash
        and block["contentHash"] == actual_content_hash
        and parents_canonical
        and not self_ref
    )
    return {
        "ok": ok,
        "expected": expected,
        "actual": actual,
        "expectedContentHash": expected_content_hash,
        "actualContentHash": actual_content_hash,
        "canonicalParents": canonical_parents,
        "parentsCanonical": parents_canonical,
        "selfRef": self_ref,
    }


def validate_signed_block(signed_block: Dict[str, Any], verifier: Verifier | dict[str, Verifier]) -> Dict[str, Any]:
    block = signed_block["block"]
    result = validate_block(block)
    attestations = signed_block.get("attestations") or ([signed_block["attestation"]] if signed_block.get("attestation") else [])
    if not attestations:
        return {**result, "ok": False, "attestation": {"ok": False, "attester": "", "algorithm": "", "reason": "no attestation present"}, "attestations": []}
    validations = []
    for att in attestations:
        if att.get("blockHash") != block["blockHash"]:
            validations.append({"ok": False, "attester": att.get("attester", ""), "algorithm": att.get("algorithm", ""), "reason": "attestation.blockHash does not match block.blockHash"})
            continue
        if (not isinstance(att.get("timestamp"), int) or isinstance(att.get("timestamp"), bool)
                or att["timestamp"] < 0 or att["timestamp"] > 2**53 - 1):
            validations.append({"ok": False, "attester": att.get("attester", ""), "algorithm": att.get("algorithm", ""), "reason": "attestation.timestamp must be a non-negative safe integer"})
            continue
        selected = verifier.get(att.get("algorithm")) if isinstance(verifier, dict) else (verifier if verifier.algorithm == att.get("algorithm") else None)
        if selected is None:
            validations.append({"ok": False, "attester": att.get("attester", ""), "algorithm": att.get("algorithm", ""), "reason": f'no verifier for algorithm "{att.get("algorithm", "")}"'})
            continue
        digest = derive_attestation_digest(att["blockHash"], att["attester"], att["algorithm"], att["timestamp"])
        sig = selected.verify(digest, att.get("signature", ""), att.get("attester"))
        validations.append({
            "ok": bool(sig.get("ok")),
            "attester": sig.get("signer") or att.get("attester", ""),
            "algorithm": att.get("algorithm", ""),
            **({} if sig.get("ok") else {"reason": "signature verification failed"}),
        })
    all_ok = all(v["ok"] for v in validations)
    return {**result, "ok": result["ok"] and all_ok, "attestation": validations[0], "attestations": validations}


def normalize_hash(h: str) -> str:
    if not isinstance(h, str):
        raise ValueError("[ALX_INVALID_HASH] hash must be a string")
    s = h.strip().lower()
    if not HASH_PATTERN.match(s):
        raise ValueError(f"[ALX_INVALID_HASH] invalid hash: {h}")
    return s


def normalize_hashes(hashes: Any = _OMITTED_PARENT_HASHES) -> List[str]:
    if hashes is _OMITTED_PARENT_HASHES:
        return []
    if not isinstance(hashes, list):
        raise ValueError("[ALX_INVALID_HASH] parentHashes must be an array")
    result = set()
    for h in hashes:
        result.add(normalize_hash(h))
    normalized = sorted(result)
    if len(normalized) > MAX_PARENTS:
        raise ValueError(f"[ALX_TOO_MANY_PARENTS] parentHashes exceeds maximum of {MAX_PARENTS} after normalization")
    return normalized

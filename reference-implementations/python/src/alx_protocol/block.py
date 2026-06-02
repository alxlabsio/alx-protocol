"""ALX Protocol — Block primitive."""

import re
import time
from typing import Any, Dict, List, Optional
from eth_hash.auto import keccak
from alx_protocol.canonical import canonicalize
from alx_protocol.signatures import BlockAttestation, Signer, Verifier

HASH_PATTERN = re.compile(r"^0x[a-f0-9]{64}$")
MAX_PARENTS = 256


def derive_block_hash(content: Any, parent_hashes: Optional[List[str]] = None) -> str:
    parents = normalize_hashes(parent_hashes or [])
    canonical = canonicalize({"content": content, "parentHashes": parents})
    return "0x" + keccak(canonical.encode("utf-8")).hex()


def derive_content_hash(content: Any) -> str:
    canonical = canonicalize(content if content is not None else None)
    return "0x" + keccak(canonical.encode("utf-8")).hex()


def create_block(content: Any, parent_hashes: Optional[List[str]] = None) -> Dict[str, Any]:
    parents = normalize_hashes(parent_hashes or [])
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
    if not isinstance(ts, int) or ts < 0:
        raise ValueError("timestamp must be a non-negative integer")
    att = BlockAttestation(block_hash, signer.get_id(), signer.algorithm, ts, signer.sign(bytes.fromhex(block_hash[2:])))
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
    version = block.get("protocolVersion")
    if version is not None and version != "1":
        raise ValueError(f"[ALX_UNSUPPORTED_VERSION] Unsupported protocolVersion: \"{version}\". Only \"1\" is recognized.")
    canonical_parents = normalize_hashes(block.get("parentHashes", []))
    expected = derive_block_hash(block.get("content"), block.get("parentHashes", []))
    actual = normalize_hash(block["blockHash"])
    expected_content_hash = derive_content_hash(block.get("content"))
    actual_content_hash = normalize_hash(block["contentHash"])
    parents_canonical = block.get("parentHashes", []) == canonical_parents
    self_ref = actual in canonical_parents
    ok = (
        expected == actual
        and expected_content_hash == actual_content_hash
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
    data = bytes.fromhex(block["blockHash"][2:])
    for att in attestations:
        if att.get("blockHash") != block["blockHash"]:
            validations.append({"ok": False, "attester": att.get("attester", ""), "algorithm": att.get("algorithm", ""), "reason": "attestation.blockHash does not match block.blockHash"})
            continue
        if not isinstance(att.get("timestamp"), int) or att["timestamp"] < 0:
            validations.append({"ok": False, "attester": att.get("attester", ""), "algorithm": att.get("algorithm", ""), "reason": "attestation.timestamp must be a non-negative integer"})
            continue
        selected = verifier.get(att.get("algorithm")) if isinstance(verifier, dict) else (verifier if verifier.algorithm == att.get("algorithm") else None)
        if selected is None:
            validations.append({"ok": False, "attester": att.get("attester", ""), "algorithm": att.get("algorithm", ""), "reason": f'no verifier for algorithm "{att.get("algorithm", "")}"'})
            continue
        sig = selected.verify(data, att.get("signature", ""), att.get("attester"))
        validations.append({
            "ok": bool(sig.get("ok")),
            "attester": sig.get("signer") or att.get("attester", ""),
            "algorithm": att.get("algorithm", ""),
            **({} if sig.get("ok") else {"reason": "signature verification failed"}),
        })
    all_ok = all(v["ok"] for v in validations)
    return {**result, "ok": result["ok"] and all_ok, "attestation": validations[0], "attestations": validations}


def normalize_hash(h: str) -> str:
    s = str(h).strip().lower()
    if not HASH_PATTERN.match(s):
        raise ValueError(f"invalid hash: {h}")
    return s


def normalize_hashes(hashes: List[str]) -> List[str]:
    result = set()
    for h in hashes:
        s = str(h).strip().lower()
        if HASH_PATTERN.match(s):
            result.add(s)
    normalized = sorted(result)
    if len(normalized) > MAX_PARENTS:
        raise ValueError(f"parentHashes exceeds maximum of {MAX_PARENTS} after normalization")
    return normalized

"""ALX Protocol — replay-window helpers."""

from typing import Any


def build_replay_scope_key(actor: str, nonce: str, chain_id: int | None = None, domain: str | None = None) -> str:
    if not actor:
        raise ValueError("actor is required")
    if not nonce:
        raise ValueError("nonce is required")
    return "\0".join([str(actor), str(nonce), "*" if chain_id is None else str(chain_id), "*" if domain is None else str(domain)])


def validate_replay_window(payload: dict[str, Any], *, now_seconds: int, seen_nonce_keys: set[str] | None = None, expected_chain_id: int | None = None, expected_domain: str | None = None, allowed_clock_skew_seconds: int = 0) -> dict[str, Any]:
    seen_nonce_keys = seen_nonce_keys or set()
    actor = str(payload.get("actor") or "")
    nonce = str(payload.get("nonce") or "")
    expiry = payload.get("expiry")
    chain_id = payload.get("chainId")
    domain = payload.get("domain")

    if not actor:
        return {"ok": False, "code": "missing_actor"}
    if not nonce:
        return {"ok": False, "code": "missing_nonce"}
    if not isinstance(expiry, int):
        return {"ok": False, "code": "missing_expiry"}
    if expected_chain_id is not None and chain_id != expected_chain_id:
        return {"ok": False, "code": "chain_mismatch"}
    if expected_domain is not None and domain != expected_domain:
        return {"ok": False, "code": "domain_mismatch"}
    if expiry + allowed_clock_skew_seconds < now_seconds:
        return {"ok": False, "code": "expired"}

    nonce_key = build_replay_scope_key(actor, nonce, chain_id, domain)
    if nonce_key in seen_nonce_keys:
        return {"ok": False, "code": "replayed_nonce", "nonceKey": nonce_key}
    return {"ok": True, "code": "ok", "nonceKey": nonce_key}

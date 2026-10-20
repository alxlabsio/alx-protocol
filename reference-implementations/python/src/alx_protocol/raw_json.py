"""Strict raw JSON ingress helpers for ALX transport and file boundaries."""

from __future__ import annotations

import json
from typing import Any


def decode_strict_json_bytes(raw: bytes) -> Any:
    source = raw.decode("utf-8", errors="strict")

    def reject_duplicates(pairs: list[tuple[str, object]]) -> dict[str, object]:
        result: dict[str, object] = {}
        for key, value in pairs:
            if key in result:
                raise ValueError(f"duplicate JSON member: {key}")
            result[key] = value
        return result

    return json.loads(
        source,
        object_pairs_hook=reject_duplicates,
        parse_constant=lambda value: (_ for _ in ()).throw(
            ValueError(f"invalid JSON constant: {value}")
        ),
    )


def decode_strict_json_hex(raw_hex: str) -> Any:
    return decode_strict_json_bytes(bytes.fromhex(raw_hex))

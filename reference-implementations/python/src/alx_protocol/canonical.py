"""
ALX Protocol — Canonicalization.

Deterministic JSON serialization. Layer 1 of the protocol.

Rules:
  - Objects: plain string-keyed mappings sorted by UTF-16 code units
  - Arrays: order-preserving (not sorted)
  - null/None: canonicalizes to "null"
  - Numbers: -0 → 0, safe integer range enforced, non-finite rejected
  - Strings: JSON-escaped
  - Depth limit: 128
  - Float formatting: must match JS JSON.stringify (ECMAScript Number::toString)
"""

import json
import math
import re
from decimal import Decimal
from typing import Any

MAX_DEPTH = 128
MAX_SAFE_INTEGER = 2**53 - 1
MIN_SAFE_INTEGER = -(2**53 - 1)


def _format_float_js(value: float) -> str:
    """Format a float to match JavaScript JSON.stringify output exactly.

    JS uses decimal when 1e-6 <= |value| < 1e21, scientific otherwise.
    Python repr() already produces the shortest round-trippable decimal.
    Convert scientific notation to decimal only in the range where
    ECMAScript Number::toString requires decimal notation.
    """
    abs_val = abs(value)

    shortest = repr(value)

    if abs_val != 0 and 1e-6 <= abs_val < 1e21:
        if "e" in shortest.lower():
            shortest = format(Decimal(shortest), "f")
        if "." in shortest:
            shortest = shortest.rstrip("0").rstrip(".")
        return shortest

    # Scientific notation — strip exponent zero-padding to match JS
    s = shortest

    def fix_exp(m):
        sign = m.group(1)
        digits = m.group(2).lstrip('0') or '0'
        return f"e{sign}{digits}"

    return re.sub(r'e([+-])(\d+)', fix_exp, s)


def canonicalize(value: Any) -> str:
    """Canonicalize a JSON value with protocol-owned recursion state."""
    return _canonicalize(value, 0, set())


def _assert_valid_unicode(value: str) -> None:
    if any(0xD800 <= ord(char) <= 0xDFFF for char in value):
        raise ValueError("[ALX_CANONICALIZATION_INVALID_UNICODE] Unpaired UTF-16 surrogate")


def _canonicalize(value: Any, depth: int, seen: set[int]) -> str:
    if depth > MAX_DEPTH:
        raise ValueError(f"[ALX_CANONICALIZATION_DEPTH] Canonicalization depth exceeded {MAX_DEPTH}")

    if value is None:
        return "null"

    if isinstance(value, bool):
        return "true" if value else "false"

    if isinstance(value, int) and not isinstance(value, bool):
        if value > MAX_SAFE_INTEGER or value < MIN_SAFE_INTEGER:
            raise ValueError(f"[ALX_CANONICALIZATION_UNSAFE_INTEGER] Integer out of safe range: {value}")
        return str(value)

    if isinstance(value, float):
        if not math.isfinite(value):
            raise ValueError(f"[ALX_CANONICALIZATION_NON_FINITE] Non-finite number not allowed: {value}")
        if value == 0.0 and math.copysign(1.0, value) == -1.0:
            return "0"  # -0 → 0
        if value.is_integer():
            if value > MAX_SAFE_INTEGER or value < MIN_SAFE_INTEGER:
                raise ValueError(f"[ALX_CANONICALIZATION_UNSAFE_INTEGER] Integer out of safe range: {value}")
            return str(int(value))
        return _format_float_js(value)

    if isinstance(value, str):
        _assert_valid_unicode(value)
        return json.dumps(value, ensure_ascii=False)

    if type(value) is list:
        identity = id(value)
        if identity in seen:
            raise ValueError("[ALX_CANONICALIZATION_CYCLIC] Cyclic structures cannot be canonicalized")
        seen.add(identity)
        try:
            return "[" + ",".join(_canonicalize(v, depth + 1, seen) for v in value) + "]"
        finally:
            seen.remove(identity)

    if type(value) is dict:
        identity = id(value)
        if identity in seen:
            raise ValueError("[ALX_CANONICALIZATION_CYCLIC] Cyclic structures cannot be canonicalized")
        seen.add(identity)
        try:
            if not all(isinstance(key, str) for key in value):
                raise TypeError("[ALX_CANONICALIZATION_UNSUPPORTED_TYPE] Object keys must be strings")
            for key in value:
                _assert_valid_unicode(key)
            keys = sorted(value.keys(), key=lambda key: key.encode("utf-16-be", "surrogatepass"))
            parts = []
            for k in keys:
                parts.append(
                    json.dumps(str(k), ensure_ascii=False)
                    + ":"
                    + _canonicalize(value[k], depth + 1, seen)
                )
            return "{" + ",".join(parts) + "}"
        finally:
            seen.remove(identity)

    raise TypeError(f"[ALX_CANONICALIZATION_UNSUPPORTED_TYPE] Unsupported type for canonicalization: {type(value).__name__}")

"""
ALX Protocol — Canonicalization.

Deterministic JSON serialization. Layer 1 of the protocol.

Rules:
  - Objects: keys sorted lexicographically, undefined/None values excluded
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
from typing import Any

MAX_DEPTH = 128
MAX_SAFE_INTEGER = 2**53 - 1
MIN_SAFE_INTEGER = -(2**53 - 1)


def _format_float_js(value: float) -> str:
    """Format a float to match JavaScript JSON.stringify output (shortest decimal).

    JS uses decimal when 1e-6 <= |value| < 1e21, scientific otherwise.
    We use Python's general format with 17 significant digits (".17g") to
    produce the shortest round-trip decimal for IEEE-754 doubles in most cases.
    For the scientific range we normalize exponent formatting to match JS.
    """
    abs_val = abs(value)

    # Decimal notation for range 1e-6 <= |v| < 1e21 (and non-zero)
    if abs_val != 0 and 1e-6 <= abs_val < 1e21:
        # Use general format which yields the shortest representation that
        # typically round-trips for IEEE-754 doubles.
        s = format(value, ".17g")
        # Python can produce uppercase 'INF'/'NAN' in some cases, but those
        # non-finite values are handled earlier in canonicalize.
        return s

    # Scientific notation: produce normalized 'e' form with no leading zeros
    s = format(value, ".17e").replace("E", "e")
    # Remove leading zeros in exponent (e+01 -> e+1, e-07 -> e-7)
    s = re.sub(r"e([+-])0*(\d+)", lambda m: f"e{m.group(1)}{m.group(2)}", s)
    return s


def canonicalize(value: Any, _depth: int = 0) -> str:
    if _depth > MAX_DEPTH:
        raise ValueError(f"Canonicalization depth exceeded {MAX_DEPTH}")

    if value is None:
        return "null"

    if isinstance(value, bool):
        return "true" if value else "false"

    if isinstance(value, int) and not isinstance(value, bool):
        if value > MAX_SAFE_INTEGER or value < MIN_SAFE_INTEGER:
            raise ValueError(f"Integer out of safe range: {value}")
        return str(value)

    if isinstance(value, float):
        if not math.isfinite(value):
            raise ValueError(f"Non-finite number not allowed: {value}")
        if value == 0.0 and math.copysign(1.0, value) == -1.0:
            return "0"  # -0 → 0
        if value == int(value) and MIN_SAFE_INTEGER <= value <= MAX_SAFE_INTEGER:
            return str(int(value))
        return _format_float_js(value)

    if isinstance(value, str):
        return json.dumps(value, ensure_ascii=False)

    if isinstance(value, list):
        return "[" + ",".join(canonicalize(v, _depth + 1) for v in value) + "]"

    if isinstance(value, dict):
        keys = sorted(value.keys())
        parts = []
        for k in keys:
            parts.append(json.dumps(str(k), ensure_ascii=False) + ":" + canonicalize(value[k], _depth + 1))
        return "{" + ",".join(parts) + "}"

    raise TypeError(f"Unsupported type for canonicalization: {type(value).__name__}")

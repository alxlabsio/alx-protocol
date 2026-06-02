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
    """Format a float to match JavaScript JSON.stringify output exactly.

    JS uses decimal when 1e-6 <= |value| < 1e21, scientific otherwise.
    We format with 20 decimal places then strip trailing zeros for the
    decimal range, and fix exponent zero-padding for the scientific range.
    """
    abs_val = abs(value)

    if abs_val != 0 and 1e-6 <= abs_val < 1e21:
        # JS uses decimal notation here — format and strip trailing zeros
        formatted = f"{value:.20f}"
        formatted = formatted.rstrip('0').rstrip('.')
        if float(formatted) == value:
            return formatted

    # Scientific notation — strip exponent zero-padding to match JS
    s = repr(value)

    def fix_exp(m):
        sign = m.group(1)
        digits = m.group(2).lstrip('0') or '0'
        return f"e{sign}{digits}"

    return re.sub(r'e([+-])(\d+)', fix_exp, s)


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

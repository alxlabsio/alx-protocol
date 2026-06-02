#!/usr/bin/env python3
"""
Replay Python conformance vector tests (same checks as tests/test_vectors.py).

Usage (from reference-implementations/python, after `pip install -e ".[dev]"`):

    python verify_vectors.py
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def main() -> int:
    test_file = ROOT / "tests" / "test_vectors.py"
    return subprocess.call(
        [sys.executable, "-m", "pytest", str(test_file), "-v"],
        cwd=ROOT,
    )


if __name__ == "__main__":
    raise SystemExit(main())

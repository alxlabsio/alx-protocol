"""ALX Protocol CLI — Python reference implementation.

Usage:
  python -m alx_protocol validate <file>
  python -m alx_protocol trace <hash-prefix> --file <graph.json>
"""

import io
import json
import sys
from pathlib import Path

from alx_protocol import (
    __version__,
    build_graph,
    decode_strict_json_bytes,
    trace_attribution,
    validate_block,
    validate_graph,
)


def _bold(s):  return f"\033[1m{s}\033[0m"
def _green(s): return f"\033[32m{s}\033[0m"
def _red(s):   return f"\033[31m{s}\033[0m"
def _dim(s):   return f"\033[2m{s}\033[0m"

TICK  = _green("✓")
CROSS = _red("✗")

CORE_BLOCK_FIELDS = {
    "blockHash",
    "contentHash",
    "parentHashes",
    "content",
    "protocolVersion",
}


def _load_strict_json(path: Path):
    try:
        return decode_strict_json_bytes(path.read_bytes())
    except (OSError, UnicodeError, ValueError, json.JSONDecodeError) as error:
        print(f"{CROSS}  invalid JSON input: {error}", file=sys.stderr)
        sys.exit(1)


def _validate_received_block(block):
    if type(block) is not dict or set(block) != CORE_BLOCK_FIELDS:
        raise ValueError(
            "[ALX_SCHEMA_INVALID] received Block fields do not match the core Block schema"
        )
    if not isinstance(block["parentHashes"], list):
        raise ValueError("[ALX_SCHEMA_INVALID] parentHashes must be an array")
    result = validate_block(block)
    if not result["ok"]:
        raise ValueError("[ALX_SCHEMA_INVALID] received Block is invalid or non-canonical")
    return block


def cmd_validate(args):
    if not args:
        print("Usage: python -m alx_protocol validate <file>", file=sys.stderr)
        sys.exit(1)

    path = Path(args[0])
    if not path.exists():
        print(f"{CROSS}  file not found: {path}", file=sys.stderr)
        sys.exit(1)

    data = _load_strict_json(path)

    if isinstance(data, list):
        try:
            for block in data:
                _validate_received_block(block)
        except (KeyError, TypeError, ValueError) as error:
            print(f"{CROSS}  {error}", file=sys.stderr)
            sys.exit(1)
        graph = build_graph(data)
        result = validate_graph(graph)
        if result["ok"]:
            print(f"  {TICK}  {_bold(str(result['blocks']))} blocks valid")
            print(f"  {TICK}  DAG structure valid "
                  f"({result['blocks']} blocks, {result['edges']} edges)")
            print(f"  {TICK}  {_dim(f'alx-protocol Python v{__version__}')}")
        else:
            print(f"  {CROSS}  validation failed "
                  f"({len(result['issues'])} issue(s))")
            for issue in result["issues"]:
                print(f"       {issue['blockHash'][:18]}...  "
                      f"{json.dumps({k: v for k, v in issue.items() if k not in ('ok', 'blockHash')})}")
            sys.exit(1)
    elif isinstance(data, dict):
        try:
            _validate_received_block(data)
            result = validate_block(data)
        except (KeyError, TypeError, ValueError) as error:
            print(f"{CROSS}  {error}", file=sys.stderr)
            sys.exit(1)
        if result["ok"]:
            bh = data.get("blockHash", "")[:18]
            print(f"  {TICK}  block {bh}... valid")
            print(f"  {TICK}  {_dim(f'alx-protocol Python v{__version__}')}")
        else:
            print(f"  {CROSS}  block invalid")
            print(f"       expected: {result.get('expected')}")
            print(f"       actual:   {result.get('actual')}")
            sys.exit(1)
    else:
        print(f"{CROSS}  unrecognised file format (expected JSON array or object)",
              file=sys.stderr)
        sys.exit(1)


def cmd_trace(args):
    hash_prefix = None
    file_path = None
    i = 0
    while i < len(args):
        if args[i] in ("--file", "-f") and i + 1 < len(args):
            file_path = args[i + 1]
            i += 2
        else:
            if hash_prefix is None:
                hash_prefix = args[i]
            i += 1

    if not hash_prefix or not file_path:
        print("Usage: python -m alx_protocol trace <hash-prefix> --file <graph.json>",
              file=sys.stderr)
        sys.exit(1)

    path = Path(file_path)
    if not path.exists():
        print(f"{CROSS}  file not found: {path}", file=sys.stderr)
        sys.exit(1)

    data = _load_strict_json(path)
    if not isinstance(data, list):
        print(f"{CROSS}  trace requires a graph file (JSON array)", file=sys.stderr)
        sys.exit(1)

    try:
        for block in data:
            _validate_received_block(block)
        graph = build_graph(data)
    except (KeyError, TypeError, ValueError) as error:
        print(f"{CROSS}  {error}", file=sys.stderr)
        sys.exit(1)

    # Resolve hash prefix: strip only a literal leading "0x" (lstrip would also
    # eat leading zero hex digits) and compare the remaining lowercase hex.
    prefix = hash_prefix.lower().removeprefix("0x")
    if not prefix:
        print(f"{CROSS}  hash prefix must contain at least one hex digit: {hash_prefix}",
              file=sys.stderr)
        sys.exit(1)
    matches = [h for h in graph if h.lower().removeprefix("0x").startswith(prefix)]
    if not matches:
        print(f"{CROSS}  no block matching prefix: {hash_prefix}", file=sys.stderr)
        sys.exit(1)
    if len(matches) > 1:
        print(f"{CROSS}  ambiguous prefix matches {len(matches)} blocks", file=sys.stderr)
        sys.exit(1)

    root_hash = matches[0]
    result = trace_attribution(root_hash, graph)

    print(f"  trace from  {root_hash[:18]}...")
    print()
    for node in result["nodes"]:
        h = node["hash"][:18]
        pc = node["pathCount"]
        depth = node["minDepth"]
        pc_str = f"pathCount={pc}" if int(pc) > 1 else ""
        print(f"  depth {depth}  {h}...  {_bold(pc_str) if pc_str else ''}")

    print()
    has_multi = any(int(n["pathCount"]) > 1 for n in result["nodes"])
    if has_multi:
        print(_dim("  pathCount = number of distinct declared paths from the root to that ancestor"))
    print(f"  {TICK}  {_dim(f'alx-protocol Python v{__version__}')}")


def main():
    # Ensure UTF-8 output on Windows
    if hasattr(sys.stdout, "buffer"):
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    if hasattr(sys.stderr, "buffer"):
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

    args = sys.argv[1:]
    if not args:
        print("Usage: python -m alx_protocol <validate|trace> [options]")
        sys.exit(0)

    cmd = args[0]
    rest = args[1:]

    if cmd == "validate":
        cmd_validate(rest)
    elif cmd == "trace":
        cmd_trace(rest)
    else:
        print(f"Unknown command: {cmd}", file=sys.stderr)
        print("Usage: python -m alx_protocol <validate|trace> [options]", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()

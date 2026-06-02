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
    validate_graph,
    validate_block,
    trace_attribution,
)


def _bold(s):  return f"\033[1m{s}\033[0m"
def _green(s): return f"\033[32m{s}\033[0m"
def _red(s):   return f"\033[31m{s}\033[0m"
def _dim(s):   return f"\033[2m{s}\033[0m"

TICK  = _green("✓")
CROSS = _red("✗")


def cmd_validate(args):
    if not args:
        print("Usage: python -m alx_protocol validate <file>", file=sys.stderr)
        sys.exit(1)

    path = Path(args[0])
    if not path.exists():
        print(f"{CROSS}  file not found: {path}", file=sys.stderr)
        sys.exit(1)

    data = json.loads(path.read_text(encoding="utf-8"))

    if isinstance(data, list):
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
        result = validate_block(data)
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

    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        print(f"{CROSS}  trace requires a graph file (JSON array)", file=sys.stderr)
        sys.exit(1)

    graph = build_graph(data)

    # Resolve hash prefix
    prefix = hash_prefix.lower().lstrip("0x")
    matches = [h for h in graph if h.lstrip("0x").startswith(prefix)
               or h.startswith(hash_prefix.lower())]
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
        pc_str = f"pathCount={pc}" if pc > 1 else ""
        print(f"  depth {depth}  {h}...  {_bold(pc_str) if pc > 1 else ''}")

    print()
    has_multi = any(n["pathCount"] > 1 for n in result["nodes"])
    if has_multi:
        print(_dim("  pathCount = independent causal paths from root to that ancestor"))
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

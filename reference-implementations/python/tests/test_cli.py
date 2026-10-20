import json

import pytest

from alx_protocol import create_block
from alx_protocol.__main__ import cmd_trace


def _write_graph(tmp_path, blocks):
    path = tmp_path / "graph.json"
    path.write_text(json.dumps(blocks), encoding="utf-8")
    return path


def _first_root_block_where(predicate, content):
    for revision in range(4096):
        block = create_block({**content, "revision": revision}, [])
        if predicate(block["blockHash"]):
            return block
    raise AssertionError("no revision produced a blockHash with the requested shape")


def _leading_zero_block_pair():
    # leading: blockHash 0x00<d>... with d != 0
    # intended: blockHash 0x0<d>..., the Block the short prefix 0x0<d> names
    leading = _first_root_block_where(
        lambda h: h[2:4] == "00" and h[4] != "0",
        {"type": "compliance-review", "control": "SOC 2 CC6.1", "status": "passed"},
    )
    short_prefix = "0x0" + leading["blockHash"][4]
    intended = _first_root_block_where(
        lambda h: h.startswith(short_prefix),
        {"type": "vendor-risk-summary", "vendor": "Northwind Analytics", "tier": "high"},
    )
    return leading, intended, short_prefix


def test_trace_cli_prints_single_block_graph(tmp_path, capsys):
    note = create_block({"type": "note", "text": "Hello ALX"}, [])
    path = _write_graph(tmp_path, [note])

    cmd_trace([note["blockHash"][:10], "--file", str(path)])

    output = capsys.readouterr().out
    assert f"depth 0  {note['blockHash'][:18]}..." in output
    assert "pathCount=" not in output


def test_trace_cli_prints_diamond_graph_with_decimal_path_count(tmp_path, capsys):
    source = create_block({"type": "market-research-source", "region": "EU"}, [])
    analysis = create_block(
        {"type": "competitor-analysis", "finding": "Two vendors lead the EU segment"},
        [source["blockHash"]],
    )
    report = create_block(
        {"type": "market-research-report", "title": "EU vendor landscape"},
        [analysis["blockHash"], source["blockHash"]],
    )
    path = _write_graph(tmp_path, [source, analysis, report])

    cmd_trace([report["blockHash"][:10], "--file", str(path)])

    output = capsys.readouterr().out
    assert f"depth 0  {report['blockHash'][:18]}..." in output
    assert f"depth 1  {analysis['blockHash'][:18]}..." in output
    assert f"depth 1  {source['blockHash'][:18]}...  \033[1mpathCount=2\033[0m" in output
    assert "pathCount = number of distinct declared paths from the root to that ancestor" in output


def test_trace_cli_prefix_matches_hex_digits_after_literal_0x(tmp_path, capsys):
    leading, intended, short_prefix = _leading_zero_block_pair()
    path = _write_graph(tmp_path, [leading, intended])

    cmd_trace([short_prefix, "--file", str(path)])
    output = capsys.readouterr().out
    assert f"trace from  {intended['blockHash'][:18]}..." in output
    assert leading["blockHash"][:18] not in output

    cmd_trace([leading["blockHash"][:5], "--file", str(path)])
    output = capsys.readouterr().out
    assert f"trace from  {leading['blockHash'][:18]}..." in output
    assert intended["blockHash"][:18] not in output


def test_trace_cli_prefix_does_not_skip_leading_zero_hex_digits(tmp_path, capsys):
    leading, _, short_prefix = _leading_zero_block_pair()
    path = _write_graph(tmp_path, [leading])

    with pytest.raises(SystemExit) as exit_info:
        cmd_trace([short_prefix, "--file", str(path)])

    assert exit_info.value.code == 1
    captured = capsys.readouterr()
    assert captured.out == ""
    assert f"no block matching prefix: {short_prefix}" in captured.err


@pytest.mark.parametrize("hash_prefix", ["0x", "0X"])
def test_trace_cli_rejects_prefix_without_hex_digits(tmp_path, capsys, hash_prefix):
    report = create_block({"type": "security-analysis", "scope": "multi-vendor API gateway"}, [])
    path = _write_graph(tmp_path, [report])

    with pytest.raises(SystemExit) as exit_info:
        cmd_trace([hash_prefix, "--file", str(path)])

    assert exit_info.value.code == 1
    captured = capsys.readouterr()
    assert captured.out == ""
    assert "hash prefix must contain at least one hex digit" in captured.err

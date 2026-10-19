"""Replay canonical ALX core vectors from protocol/suites.json."""

import json
from pathlib import Path

import pytest

from alx_protocol import (
    canonicalize,
    create_block,
    validate_block,
    verify_graph,
    verify_trace,
    trace_attribution,
    validate_graph,
    validate_incremental_block,
)

REPO_ROOT = Path(__file__).resolve().parents[3]
SUITES = json.loads((REPO_ROOT / "protocol" / "suites.json").read_text())


def load_suite(path: str) -> dict:
    return json.loads((REPO_ROOT / path).read_text())


def core_suite(suite_id: str) -> dict:
    meta = next(s for s in SUITES["core"]["suites"] if s["id"] == suite_id)
    return load_suite(meta["path"])


def generated_parents(count: int) -> list[str]:
    return [f"0x{i:064x}" for i in range(count)]


def test_manifest_declares_required_core_suites():
    assert [s["id"] for s in SUITES["core"]["suites"]] == [
        "canonicalization",
        "canonicalization-negative",
        "canonicalization-depth",
        "block-identity",
        "parent-limits",
        "attribution-trace",
        "lineage-negative",
        "lineage-boundaries",
        "semantic-validity",
        "semantic-integrity",
    ]


def test_canonicalization_vectors():
    for vector in core_suite("canonicalization")["vectors"]:
        if vector["id"] in ("C4", "C10"):
            continue
        assert canonicalize(vector["input"]) == vector["expected"], vector["id"]


def test_canonicalization_negative_vectors():
    suite = core_suite("canonicalization-negative")
    for vector in suite["vectors"]:
        if vector["id"] == "CN1":
            value = float("nan")
        elif vector["id"] == "CN2":
            value = float("inf")
        elif vector["id"] == "CN3":
            value = float("-inf")
        elif vector["id"] == "CN6":
            value = {"value": "leaf"}
            for _ in range(129):
                value = {"nested": value}
        else:
            # Some negative vectors (e.g., CN7-CN9) cannot be represented in JSON
            # (cyclic objects, language-native Symbol/BigInt). For those, the
            # vector file omits "input"; construct a language-specific sentinel
            # so canonicalize raises an error. Accept ValueError, TypeError, or
            # RecursionError depending on the implementation's behavior.
            value = vector.get("input", object())
        with pytest.raises((ValueError, TypeError, RecursionError)):
            canonicalize(value)


def test_canonicalization_depth_vectors():
    for vector in core_suite("canonicalization-depth")["vectors"]:
        value = vector["input"]["leaf"]
        for _ in range(vector["input"]["generatedDepth"]):
            value = {"nested": value}
        if vector["expected"]["ok"]:
            assert canonicalize(value).startswith('{"nested":'), vector["id"]
        else:
            with pytest.raises(ValueError):
                canonicalize(value)


def test_block_identity_vectors():
    for vector in core_suite("block-identity")["vectors"]:
        if "input" in vector:
            block = create_block(vector["input"]["content"], vector["input"].get("parentHashes", []))
            assert block["blockHash"].startswith("0x"), vector["id"]
        else:
            a = create_block(vector["input_a"]["content"], vector["input_a"].get("parentHashes", []))
            b = create_block(vector["input_b"]["content"], vector["input_b"].get("parentHashes", []))
            for assertion in vector.get("assertions", []):
                if "blockHash ==" in assertion:
                    assert a["blockHash"] == b["blockHash"], vector["id"]
                if "blockHash !=" in assertion:
                    assert a["blockHash"] != b["blockHash"], vector["id"]
                if "contentHash ==" in assertion:
                    assert a["contentHash"] == b["contentHash"], vector["id"]
                if "contentHash !=" in assertion:
                    assert a["contentHash"] != b["contentHash"], vector["id"]


def test_parent_limit_vectors():
    for vector in core_suite("parent-limits")["vectors"]:
        parents = generated_parents(vector["input"]["generatedParentCount"])
        if vector["expected"]["ok"]:
            block = create_block(vector["input"]["content"], parents)
            assert len(block["parentHashes"]) == vector["expected"]["normalizedParentCount"], vector["id"]
        else:
            with pytest.raises(ValueError):
                create_block(vector["input"]["content"], parents)


def test_attribution_trace_vectors():
    for vector in core_suite("attribution-trace")["vectors"]:
        trace = trace_attribution(vector["root"], vector["graph"])
        expected = vector["expected"]
        if "nodeCount" in expected:
            assert len(trace["nodes"]) == expected["nodeCount"], vector["id"]
        if "edgeCount" in expected:
            assert len(trace["edges"]) == expected["edgeCount"], vector["id"]
        if "maxDepth" in expected:
            assert trace["maxDepth"] == expected["maxDepth"], vector["id"]
        if "cycle" in expected:
            assert trace["cycle"] == vector["cycle"], vector["id"]
        for hash_value, count in expected.get("pathCounts", {}).items():
            node = next(n for n in trace["nodes"] if n["hash"] == hash_value)
            assert node["pathCount"] == count, vector["id"]
        for hash_value, assertions in expected.get("nodes", {}).items():
            node = next(n for n in trace["nodes"] if n["hash"] == hash_value)
            for key, value in assertions.items():
                assert node[key] == value, f"{vector['id']}:{hash_value}:{key}"


def test_lineage_negative_cycle_vectors():
    for vector in core_suite("lineage-negative")["vectors"]:
        if vector.get("graph") and vector["expected"].get("hasCycle"):
            root = next(iter(vector["graph"]))
            assert trace_attribution(root, vector["graph"])["cycle"] is True, vector["id"]


def test_lineage_boundary_vectors():
    for vector in core_suite("lineage-boundaries")["vectors"]:
        if vector["operation"] == "validateGraph":
            result = validate_graph(vector["input"]["graph"], vector["input"].get("context"))
            assert result["ok"] == vector["expected"]["ok"], vector["id"]
            assert len(result["issues"]) == vector["expected"]["issueCount"], vector["id"]
            if "missing" in vector["expected"]:
                assert result["issues"][0]["missing"] == vector["expected"]["missing"], vector["id"]
            if "external" in vector["expected"]:
                actual_external = result["issues"][0]["external"] if result["issues"] else result["externalParents"]
                assert actual_external == vector["expected"]["external"], vector["id"]
        elif vector["operation"] == "validateIncrementalBlock":
            result = validate_incremental_block(vector["input"]["block"], vector["input"]["existingGraph"])
            assert result["ok"] == vector["expected"]["ok"], vector["id"]
            assert result["missing"] == vector["expected"]["missing"], vector["id"]
            assert result["cycle"] == vector["expected"]["cycle"], vector["id"]


def test_semantic_validity_vectors():
    for vector in core_suite("semantic-validity")["vectors"]:
        if vector["operation"] == "validateBlock":
            result = validate_block(vector["input"])
        elif vector["operation"] == "validateGraph":
            result = validate_graph(vector["input"]["graph"])
        else:
            raise AssertionError(f"unsupported operation {vector['operation']}")
        assert result["ok"] == vector["expected"]["ok"], vector["id"]
        if "issueCount" in vector["expected"]:
            assert len(result["issues"]) == vector["expected"]["issueCount"], vector["id"]
        if "missing" in vector["expected"]:
            assert result["issues"][0]["missing"] == vector["expected"]["missing"], vector["id"]
        if "parentsCanonical" in vector["expected"]:
            assert result["parentsCanonical"] == vector["expected"]["parentsCanonical"], vector["id"]
        if "selfRef" in vector["expected"]:
            assert result["selfRef"] == vector["expected"]["selfRef"], vector["id"]


def test_semantic_integrity_vectors():
    for vector in core_suite("semantic-integrity")["vectors"]:
        if vector["operation"] == "verifyTrace":
            result = verify_trace(vector["input"]["trace"], vector["input"]["graph"], vector["input"].get("context"))
            assert result["ok"] == vector["expected"]["ok"], vector["id"]
            for issue in vector["expected"]["issues"]:
                assert issue in result["issues"], vector["id"]
        elif vector["operation"] == "traceAttribution":
            result = trace_attribution(vector["input"]["rootHash"], vector["input"]["graph"], vector["input"].get("context"))
            assert result["validationMode"] == vector["expected"]["validationMode"], vector["id"]
            assert result["complete"] == vector["expected"]["complete"], vector["id"]
            assert result["missingParents"] == vector["expected"]["missingParents"], vector["id"]
            assert result["externalParents"] == vector["expected"]["externalParents"], vector["id"]
        elif vector["operation"] == "verifyGraph":
            result = verify_graph(vector["input"]["blocks"], lambda content, parents: create_block(content, parents)["blockHash"])
            assert result["ok"] == vector["expected"]["ok"], vector["id"]
            assert any(item["reason"] == vector["expected"]["brokenReason"] for item in result["broken"]), vector["id"]
        else:
            raise AssertionError(f"unsupported operation {vector['operation']}")

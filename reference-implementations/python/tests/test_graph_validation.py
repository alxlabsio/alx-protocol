"""Native coverage for canonical ALX Graph verification."""

import json
from pathlib import Path

import pytest

from alx_protocol import create_block, validate_graph, validate_graph_structure

REPO_ROOT = Path(__file__).resolve().parents[3]
GRAPH_SUITES = (
    "graph-validation-outcomes",
    "lineage-boundaries",
    "semantic-validity",
    "semantic-integrity",
)


def load_graph_vectors() -> list[dict]:
    manifest = json.loads((REPO_ROOT / "protocol" / "suites.json").read_text())
    descriptors = {suite["id"]: suite for suite in manifest["core"]["suites"]}
    vectors = []
    for suite_id in GRAPH_SUITES:
        document = json.loads((REPO_ROOT / descriptors[suite_id]["path"]).read_text())
        vectors.extend(vector for vector in document["vectors"] if vector["operation"] == "validateGraph")
    return vectors


@pytest.mark.parametrize("vector", load_graph_vectors(), ids=lambda vector: vector["id"])
def test_canonical_graph_vectors_match_exactly(vector: dict) -> None:
    input_data = vector["input"]

    def execute() -> dict:
        return validate_graph(input_data["seed"], input_data["source"], input_data["context"])

    if "errorCode" in vector["expected"]:
        with pytest.raises(ValueError, match=vector["expected"]["errorCode"]):
            execute()
    else:
        assert execute() == vector["expected"]


def test_finite_source_order_does_not_affect_output() -> None:
    vector = next(vector for vector in load_graph_vectors() if vector["id"] == "GVO3")
    input_data = vector["input"]
    reversed_source = {"kind": "finite", "blocks": list(reversed(input_data["source"]["blocks"]))}
    assert validate_graph(input_data["seed"], reversed_source, input_data["context"]) == vector["expected"]


def test_malformed_request_boundaries_are_rejected_before_a_checked_result() -> None:
    vector = next(vector for vector in load_graph_vectors() if vector["id"] == "GVO1")
    input_data = vector["input"]
    with pytest.raises(ValueError, match="ALX_CONTEXT_ROOT_MISMATCH"):
        validate_graph(None, input_data["source"], input_data["context"])
    with pytest.raises(ValueError, match="ALX_INVALID_GRAPH"):
        validate_graph(input_data["seed"], {"kind": "finite"}, input_data["context"])


def test_legacy_adjacency_form_remains_available() -> None:
    block_hash = "0x" + "1" * 64
    expected = validate_graph_structure({block_hash: []})
    assert validate_graph({block_hash: []}) == expected
    assert validate_graph(graph={block_hash: []}) == expected


def test_long_chain_uses_iterative_traversal() -> None:
    blocks = [create_block({"sequence": 0, "purpose": "long-chain-security-check"})]
    for sequence in range(1, 1_000):
        blocks.append(create_block(
            {"sequence": sequence, "purpose": "long-chain-security-check"},
            [blocks[sequence - 1]["blockHash"]],
        ))

    seed = blocks[-1]
    result = validate_graph(
        seed,
        {"kind": "finite", "blocks": list(reversed(blocks[:-1]))},
        {
            "protocolVersion": "1",
            "validationMode": "closed-world",
            "graphRoot": seed["blockHash"],
            "externalParents": [],
        },
    )

    assert result["status"] == "valid"
    assert result["blocksExamined"] == 1_000
    assert result["edgesExamined"] == 999
    assert result["issues"] == []

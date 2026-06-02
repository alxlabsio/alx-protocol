import copy

import alx_protocol


class FakeSigner:
    algorithm = "fake"

    def __init__(self, signer_id: str):
        self.signer_id = signer_id

    def get_id(self) -> str:
        return self.signer_id

    def sign(self, data: bytes) -> str:
        return f"{self.signer_id}:{data.hex()}"


class FakeVerifier:
    algorithm = "fake"

    def verify(self, data: bytes, signature: str, expected_signer: str | None = None) -> dict:
        signer = signature.split(":", 1)[0]
        ok = signature == f"{signer}:{data.hex()}" and (expected_signer is None or expected_signer == signer)
        return {"ok": ok, "signer": signer}


def test_signed_block_round_trip_and_multiple_attestations():
    first = FakeSigner("alice")
    second = FakeSigner("bob")
    block = alx_protocol.create_signed_block({"type": "decision"}, [], first, 1)
    block = alx_protocol.add_attestation(block, second, 2)

    assert block["attestation"]["attester"] == "alice"
    assert [att["attester"] for att in block["attestations"]] == ["alice", "bob"]

    result = alx_protocol.validate_signed_block(block, FakeVerifier())
    assert result["ok"] is True
    assert len(result["attestations"]) == 2


def test_signed_block_rejects_invalid_attestation():
    block = alx_protocol.create_signed_block({"type": "decision"}, [], FakeSigner("alice"), 1)
    tampered = copy.deepcopy(block)
    tampered["attestations"][0]["blockHash"] = "0x" + "0" * 64

    result = alx_protocol.validate_signed_block(tampered, FakeVerifier())
    assert result["ok"] is False
    assert result["attestation"]["reason"] == "attestation.blockHash does not match block.blockHash"


def test_graph_helpers_cover_incremental_workflow():
    root = alx_protocol.create_block({"type": "root"}, [])
    child = alx_protocol.create_block({"type": "child"}, [root["blockHash"]])
    graph = alx_protocol.build_graph([root])

    incremental = alx_protocol.validate_incremental_block(child, graph)
    assert incremental["ok"] is True

    alx_protocol.add_block_to_graph(child, graph)
    verified = alx_protocol.verify_graph([root, child], alx_protocol.derive_block_hash)
    assert verified == {"ok": True, "verified": 2, "broken": []}


def test_replay_helpers_cover_scoped_nonce_window():
    nonce_key = alx_protocol.build_replay_scope_key("alice", "n-1", 8453, "alx")
    ok = alx_protocol.validate_replay_window(
        {"actor": "alice", "nonce": "n-1", "expiry": 200, "chainId": 8453, "domain": "alx"},
        now_seconds=100,
    )
    replayed = alx_protocol.validate_replay_window(
        {"actor": "alice", "nonce": "n-1", "expiry": 200, "chainId": 8453, "domain": "alx"},
        now_seconds=100,
        seen_nonce_keys={nonce_key},
    )

    assert ok == {"ok": True, "code": "ok", "nonceKey": nonce_key}
    assert replayed == {"ok": False, "code": "replayed_nonce", "nonceKey": nonce_key}


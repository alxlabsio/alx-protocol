import alx_protocol


def test_version():
    assert alx_protocol.__version__ == "1.0.0"


def test_block_creation():
    block = alx_protocol.create_block("hello", [])
    assert block["blockHash"].startswith("0x")
    assert len(block["blockHash"]) == 66
    assert block["content"] == "hello"
    assert block["parentHashes"] == []


def test_block_validation():
    block = alx_protocol.create_block("test", [])
    result = alx_protocol.validate_block(block)
    assert result["ok"] is True


def test_determinism():
    a = alx_protocol.derive_block_hash("same", [])
    b = alx_protocol.derive_block_hash("same", [])
    assert a == b


def test_canonicalize():
    assert alx_protocol.canonicalize(None) == "null"
    assert alx_protocol.canonicalize({"b": 1, "a": 2}) == '{"a":2,"b":1}'

import pytest

from alx_protocol import create_block, decode_strict_json_bytes
from alx_protocol.__main__ import _validate_received_block


def test_raw_json_boundary_rejects_duplicate_members_invalid_utf8_and_trailing_data():
    with pytest.raises(ValueError, match="duplicate JSON member"):
        decode_strict_json_bytes(b'{"a":1,"a":2}')
    with pytest.raises(UnicodeDecodeError):
        decode_strict_json_bytes(b"\xff")
    with pytest.raises(ValueError):
        decode_strict_json_bytes(b"{} trailing")


def test_received_block_boundary_rejects_unknown_fields_and_noncanonical_parents():
    block = create_block({"type": "boundary"}, [])
    assert _validate_received_block(block) is block

    with pytest.raises(ValueError, match="ALX_SCHEMA_INVALID"):
        _validate_received_block({**block, "unexpected": True})

    parent = create_block({"type": "parent"}, [])
    child = create_block({"type": "child"}, [parent["blockHash"]])
    with pytest.raises(ValueError, match="ALX_SCHEMA_INVALID"):
        _validate_received_block({**child, "parentHashes": [parent["blockHash"].upper()]})

from toycrane.adapter.inbound.ws.ws_router import decode


def test_decode_rejects_non_json_and_non_objects():
    assert decode("not json") is None
    assert decode("[1]") is None
    assert decode('{"x":1}') is None
    assert decode(b'{"t":"move"}') is None  # 바이너리 프레임은 받지 않는다


def test_decode_keeps_typed_objects():
    assert decode('{"t":"move","x":1}') == {"t": "move", "x": 1}


def test_stand_message_has_a_handler():
    from toycrane.adapter.inbound.ws.ws_router import HANDLERS
    assert "stand" in HANDLERS


def test_tick_message_has_a_handler():
    from toycrane.adapter.inbound.ws.ws_router import HANDLERS
    assert "tick" in HANDLERS

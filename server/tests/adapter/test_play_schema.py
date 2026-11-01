import pytest

from toycrane.adapter.inbound.ws.schemas.play_schema import parse as parse_play


def test_play_takes_a_known_machine():
    assert parse_play({"t": "play", "m": "A-1"}) == "A-1"
    assert parse_play({"t": "play", "m": "F-14"}) == "F-14"  # 피규어 기계(9단계)


@pytest.mark.parametrize("m", ["Z-9", 1, None, True])
def test_play_rejects_unknown_machines(m):
    assert parse_play({"t": "play", "m": m}) is None

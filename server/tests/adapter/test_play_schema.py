import pytest

from toycrane.adapter.inbound.ws.schemas.drop_schema import parse as parse_drop
from toycrane.adapter.inbound.ws.schemas.play_schema import parse as parse_play


def test_play_takes_a_known_machine():
    assert parse_play({"t": "play", "m": "A-1"}) == "A-1"


@pytest.mark.parametrize("m", ["Z-9", 1, None, True])
def test_play_rejects_unknown_machines(m):
    assert parse_play({"t": "play", "m": m}) is None


def test_drop_rounds_to_three_decimals():
    assert parse_drop({"t": "drop", "x": 0.12345, "z": -0.05}) == (0.123, -0.05)


@pytest.mark.parametrize("x", ["0.1", True, float("inf"), float("nan"), None])
def test_drop_rejects_bad_numbers(x):
    assert parse_drop({"t": "drop", "x": x, "z": 0.0}) is None

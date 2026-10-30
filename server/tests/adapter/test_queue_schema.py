import pytest

from toycrane.adapter.inbound.ws.schemas.queue_schema import parse_join


def test_join_takes_counter_number():
    assert parse_join({"t": "queue", "c": 0}) == 0 and parse_join({"t": "queue", "c": 1}) == 1


@pytest.mark.parametrize("c", [2, -1, "0", True, None, 0.5])
def test_bad_counter_is_rejected(c):
    assert parse_join({"t": "queue", "c": c}) is None

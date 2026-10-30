import json
import math
from pathlib import Path

import pytest

from toycrane.domain.store_rules import choose_store, clamp_to_floor, spawn_position
from toycrane.domain.value_objects.position import Position


def test_fills_lowest_open_store():
    assert choose_store({1: 50, 2: 12}, max_stores=4) == 2


def test_opens_next_store_when_all_full():
    assert choose_store({1: 50, 2: 50}, max_stores=4) == 3


def test_empty_starts_at_one():
    assert choose_store({}, max_stores=4) == 1


def test_full_when_every_store_full():
    assert choose_store({1: 50, 2: 50, 3: 50, 4: 50}, max_stores=4) is None


def test_spawn_on_ring():
    p = spawn_position(7)
    assert math.isclose(math.hypot(p.x, p.z), 2.4)
    assert spawn_position(7) != spawn_position(8)


def test_clamp_to_floor_bounds_and_tower():
    assert clamp_to_floor(Position(13.0, -20.0)) == Position(12.6, -12.6)
    assert clamp_to_floor(Position(0.5, 1.0)) == Position(0.5, 1.3)


SHARED = Path(__file__).resolve().parents[3] / "shared"


@pytest.mark.parametrize("case", json.loads((SHARED / "clamp_fixtures.json").read_text(encoding="utf-8")))
def test_clamp_matches_shared_fixture(case):
    p = clamp_to_floor(Position(*case["in"]))
    assert (round(p.x, 3), round(p.z, 3)) == tuple(case["out"]), case["why"]

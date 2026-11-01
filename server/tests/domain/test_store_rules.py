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
    from toycrane.domain.store_rules import SPAWN_RADIUS

    p = spawn_position(7)
    assert math.isclose(math.hypot(p.x, p.z), SPAWN_RADIUS)
    assert spawn_position(7) != spawn_position(8)


def test_clamp_to_floor_bounds_and_tower():
    assert clamp_to_floor(Position(25.0, -30.0)) == Position(21.6, -21.6)
    assert clamp_to_floor(Position(0.5, 1.0)) == Position(0.5, 1.6)


# 큰 홀(설계 2026-11-01): 걸을 수 있는 범위·탑·스폰은 화면과 같은 공용 배치 파일에서 읽는다
def test_hall_values_come_from_shared_layout():
    from toycrane.domain.shared_data import LAYOUT
    from toycrane.domain.store_rules import MAP_HALF, SPAWN_RADIUS, TOWER_HALF

    hall = LAYOUT["hall"]
    assert (MAP_HALF, TOWER_HALF, SPAWN_RADIUS) == (hall["map_half"], hall["tower_half"], hall["spawn_radius"])


def test_spawn_ring_clears_the_tower():
    for seed in range(40):
        p = spawn_position(seed)
        assert clamp_to_floor(p) == p


SHARED = Path(__file__).resolve().parents[3] / "shared"


@pytest.mark.parametrize("case", json.loads((SHARED / "clamp_fixtures.json").read_text(encoding="utf-8")))
def test_clamp_matches_shared_fixture(case):
    p = clamp_to_floor(Position(*case["in"]))
    assert (round(p.x, 3), round(p.z, 3)) == tuple(case["out"]), case["why"]


# ---- 빈 구역 "준비 중" 장식이 길을 막지 않는지 (설계 2026-10-31 §3.8) ----
def reachable_from(start: Position, step: float):
    """0.25m 격자 BFS: 바닥 안이고 장애물 상자 밖인 칸만 걸을 수 있다. 돌려준 함수는 그 자리(가까운 칸)에 갈 수 있는지."""
    from collections import deque

    from toycrane.domain.layout import OBSTACLES
    from toycrane.domain.store_rules import MAP_HALF

    n = int(round(2 * MAP_HALF / step)) + 1
    cell = lambda v: min(max(int(round((v + MAP_HALF) / step)), 0), n - 1)  # noqa: E731
    at = lambda i: -MAP_HALF + i * step  # noqa: E731
    free = lambda i, j: not any(x0 < at(i) < x1 and z0 < at(j) < z1 for x0, z0, x1, z1 in OBSTACLES)  # noqa: E731
    seen = {(cell(start.x), cell(start.z))}
    queue = deque(seen)
    while queue:
        i, j = queue.popleft()
        for di, dj in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            k = (i + di, j + dj)
            if 0 <= k[0] < n and 0 <= k[1] < n and k not in seen and free(*k):
                seen.add(k)
                queue.append(k)
    return lambda p: (cell(p.x), cell(p.z)) in seen


def test_decor_keeps_every_spot_reachable():
    from toycrane.domain.layout import COUNTERS, MACHINES, front_spot
    from toycrane.domain.store_rules import SPAWN_RADIUS

    goals = [front_spot(m) for m in MACHINES.values()] + [c.window for c in COUNTERS]
    reach = reachable_from(Position(SPAWN_RADIUS, 0.0), step=0.25)
    assert all(reach(g) for g in goals)


def test_coin_counters_face_the_camera():
    """걷기 카메라는 늘 북쪽(-z)을 보므로 두 교환소 모두 남쪽(+z, ry 0)을 보고 창구가 그 앞에 있어야 등을 보이지 않는다 (설계 2026-10-31 §3.12)."""
    from toycrane.domain.layout import COUNTERS

    assert all(c.ry == 0 and c.window.z > c.z for c in COUNTERS)

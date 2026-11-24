import math
import random

import pytest

from toycrane.domain.crane import DollSpot, claw_strength, spawn_spot
from toycrane.domain.layout import MACHINE_SPEC
from toycrane.domain.shared_data import CLAW


# 새 인형 자리 (물리 뽑기 설계 §6·§9.1): 구멍 네모 밖, 다른 인형과 22cm 넘게 — 높이·돌림은 화면 물리가 정한다
def test_spawn_spot_avoids_the_hole_and_other_dolls():
    rng, spots = random.Random(1), []
    hx, hz, _ = MACHINE_SPEC.hole
    half = CLAW["hole"]["size"] / 2 + 0.05
    w, d = MACHINE_SPEC.play_half
    for uid in range(1, 401):
        x, z = spawn_spot(spots, rng)
        assert abs(x) <= w and abs(z) <= d
        assert abs(x - hx) > half or abs(z - hz) > half
        spots.append(DollSpot("bear", x, None, z, uid=uid))
        if uid <= 9:
            assert all(math.hypot(x - s.x, z - s.z) >= 0.22 for s in spots[:-1])


def test_a_new_doll_is_unsettled_until_the_screen_drops_it():
    d = DollSpot("bear", 0.1, None, 0.2, uid=3)
    assert d.y is None and d.q == (0, 0, 0, 1) and not d.settled
    assert DollSpot("bear", 0.1, 0.87, 0.2, (0, 0, 0, 1), uid=3).settled


def test_claw_strength_grows_with_distance_from_the_hole():
    hx, hz, hr = MACHINE_SPEC.hole
    w, d = MACHINE_SPEC.play_half
    assert claw_strength(hx + hr, hz) == pytest.approx(0.6)
    assert claw_strength(w, -d) == pytest.approx(1.4)  # 구멍에서 가장 먼 모서리 (±40%: shared/claw.json spread)
    assert claw_strength(hx + hr, hz) < claw_strength(0.0, 0.0) < claw_strength(w, -d)


# 인형 기계 재배치(2026-11-24): 새 인형은 못 닿는 자리(집게 가운데 범위 + out) 밖으로는 떨어뜨리지 않는다
def test_spawn_spot_stays_where_the_claw_reaches():
    from toycrane.domain.crane import REACH_HALF

    out = CLAW["reposition"]["out"]
    hx, hz, _ = MACHINE_SPEC.hole
    half = CLAW["hole"]["size"] / 2
    for seed in range(20):
        rng, spots = random.Random(seed), []
        for uid in range(10):
            x, z = spawn_spot(spots, rng)
            assert abs(x) <= REACH_HALF[0] + out and abs(z) <= REACH_HALF[1] + out
            assert abs(x - hx) > half or abs(z - hz) > half
            spots.append(DollSpot("bear", x, None, z, uid=uid))


def test_spawn_spot_still_finds_a_spot_in_a_full_machine():
    from toycrane.domain.crane import REACH_HALF

    rng = random.Random(3)
    full = [DollSpot("bear", round(-REACH_HALF[0] + 0.1 * i, 3), 0.1, round(-REACH_HALF[1] + 0.1 * j, 3), uid=i * 10 + j) for i in range(8) for j in range(7)]
    x, z = spawn_spot(full, rng)
    assert abs(x) <= REACH_HALF[0] and abs(z) <= REACH_HALF[1]


# 난이도를 건드리지 않게(시뮬: 집게 가운데 범위로 좁히면 인형이 몰려 머리 겨냥 53% → 43%) — 못 닿는 자리 바로 안쪽까지 다 쓴다
def test_spawn_spot_uses_the_whole_reachable_band():
    from toycrane.domain.crane import REACH_HALF

    rng = random.Random(4)
    xs, zs = zip(*(spawn_spot([], rng) for _ in range(2000)))
    assert max(map(abs, xs)) > REACH_HALF[0] + 0.04 and max(map(abs, zs)) > REACH_HALF[1] + 0.04

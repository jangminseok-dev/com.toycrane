import math
import random

import pytest

from toycrane.domain.catalog import DOLLS
from toycrane.domain.crane import SWAY_MAX, DollSpot, Grab, clamp_claw, generate_contents, judge, restock, sway
from toycrane.domain.layout import MACHINE_SPEC


def test_generated_contents_stay_in_play_area_and_out_of_hole():
    spots = generate_contents("soft", random.Random(1))
    assert len(spots) == 9
    hx, hz, hr = MACHINE_SPEC.hole
    for s in spots:
        assert abs(s.x) <= 0.44 and abs(s.z) <= 0.38
        assert math.hypot(s.x - hx, s.z - hz) >= hr
        assert DOLLS[s.kind].set == "soft"


def test_generated_contents_are_repeatable_for_a_seed():
    assert generate_contents("water", random.Random(7)) == generate_contents("water", random.Random(7))


# ---- 겹치지 않는 무더기 (사용자 요청 2026-10-31: 인형이 서로 파고들어 부자연스러움) ----
@pytest.mark.parametrize("seed", range(20))
def test_floor_dolls_keep_their_distance(seed):
    floor = [s for s in generate_contents("forest", random.Random(seed)) if s.y == 0]
    assert len(floor) == 6
    for i, a in enumerate(floor):
        for b in floor[i + 1:]:
            assert math.hypot(a.x - b.x, a.z - b.z) >= 0.2


@pytest.mark.parametrize("seed", range(20))
def test_top_dolls_rest_between_two_floor_dolls(seed):
    spots = generate_contents("dream", random.Random(seed))
    floor, top = [s for s in spots if s.y == 0], [s for s in spots if s.y > 0]
    assert len(top) == 3
    for t in top:
        supports = [f for f in floor if math.hypot(f.x - t.x, f.z - t.z) <= 0.17]
        assert len(supports) >= 2 and 0.1 < t.y < 0.35


def test_claw_grabs_the_top_doll_first():
    """바닥 인형 머리 바로 위를 노려도, 손이 닿는 거리에 얹힌 인형이 있으면 그 인형을 잡는다."""
    spots = [DollSpot("bear", 0.0, 0.0, 0.0), DollSpot("cat", 0.08, 0.0, 0.0, 0.22)]
    grab = judge(spots, 0.0, 0.0, roll=0.99)
    assert grab.index == 1 and grab.part == "body"


# ---- 판정 (Task 9) ----


SPOTS = [DollSpot("bunny", 0.0, 0.0, 0.0), DollSpot("starbunny", 0.3, 0.2, 0.0)]


@pytest.mark.parametrize("x, part", [(0.0, "head"), (0.08, "body"), (0.12, "arm"), (-0.35, "none")])
def test_part_depends_on_distance_to_the_nearest_doll(x, part):
    assert judge(SPOTS, x, -0.0, roll=0.99).part == part


# 보통 난이도(사용자 결정 2026-10-31): 머리 15%·몸통 8%·팔 3% 성공, 놓침은 그대로
@pytest.mark.parametrize("roll, outcome", [(0.14, "win"), (0.54, "slip"), (0.56, "miss")])
def test_head_odds(roll, outcome):
    assert judge(SPOTS, 0.0, 0.0, roll).outcome == outcome


def test_rare_wins_less_and_slips_more():
    assert judge(SPOTS, 0.3, 0.2, roll=0.06).outcome == "slip"  # 0.15×0.35 = 0.0525
    assert judge(SPOTS, 0.3, 0.2, roll=0.05).outcome == "win"


def test_empty_spot_always_misses():
    assert judge(SPOTS, -0.35, -0.3, roll=0.0) == Grab("miss", "none", None)


def test_unknown_kind_is_judged_as_normal():
    assert judge([DollSpot("gone-doll", 0, 0, 0)], 0, 0, roll=0.14).outcome == "win"


def test_restock_puts_a_new_doll_in_the_same_place():
    """뽑힌 자리에 같은 세트 새 인형이 들어간다 — 위층을 받치던 인형이 빠져도 무더기가 그대로 서 있게."""
    spots = generate_contents("dream", random.Random(3))
    after = restock(spots, 0, "dream", random.Random(4))
    assert len(after) == 9 and after[1:] == spots[1:]
    assert (after[0].x, after[0].z, after[0].y) == (spots[0].x, spots[0].z, spots[0].y)
    assert all(DOLLS[s.kind].set == "dream" for s in after)


def test_claw_is_clamped_into_the_play_area():
    assert clamp_claw(5.0, -5.0) == (0.44, -0.38)


# 내려갈 때 집게가 살짝 흔들린다 — 서버가 정하므로 화면을 고쳐도 없앨 수 없다 (사용자 요청 2026-10-31)
def test_claw_sways_a_little_off_the_aimed_spot():
    rng = random.Random(5)
    landings = [sway(0.0, 0.0, rng) for _ in range(200)]
    assert all(math.hypot(x, z) <= SWAY_MAX + 1e-9 for x, z in landings)
    assert any(math.hypot(x, z) > 0.05 for x, z in landings)  # 머리(5cm) 밖으로 벗어날 때도 있다
    assert len({(round(x, 3), round(z, 3)) for x, z in landings}) > 150


# ---- 놓친 인형이 떨어져 굴러서 근처에 멈춘다 (사용자 요청 2026-10-31) ----
from toycrane.domain.crane import drop_nearby  # noqa: E402


@pytest.mark.parametrize("seed", range(15))
def test_slipped_doll_lands_near_where_it_was(seed):
    spots = generate_contents("soft", random.Random(seed))
    top = next(i for i, s in enumerate(spots) if s.y > 0)
    after = drop_nearby(spots, top, random.Random(seed + 100))
    moved, was = after[top], spots[top]
    assert moved.kind == was.kind  # 같은 인형이 자리만 바뀐다
    assert 0.04 <= math.hypot(moved.x - was.x, moved.z - was.z) <= 0.17
    w, d = MACHINE_SPEC.play_half
    assert abs(moved.x) <= w and abs(moved.z) <= d
    assert [s for i, s in enumerate(after) if i != top] == [s for i, s in enumerate(spots) if i != top]


def test_a_floor_doll_holding_others_falls_back_to_its_place():
    """위층을 받치던 바닥 인형은 굴러가면 위층이 뜨므로 제자리로 떨어진다."""
    spots = [DollSpot("bear", 0.0, 0.0, 0.0), DollSpot("cat", 0.24, 0.0, 0.0), DollSpot("dog", 0.12, 0.0, 0.0, 0.2)]
    after = drop_nearby(spots, 0, random.Random(1))
    assert (after[0].x, after[0].z, after[0].y) == (0.0, 0.0, 0.0)

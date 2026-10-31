import math
import random

import pytest

from toycrane.domain.crane import SWAY_MAX, DollSpot, Grab, clamp_claw, judge, rest_height, sway, take_out
from toycrane.domain.stock import generate_stock
from toycrane.domain.layout import MACHINE_SPEC


def test_claw_grabs_the_top_doll_first():
    """바닥 인형 머리 바로 위를 노려도, 손이 닿는 거리에 얹힌 인형이 있으면 그 인형을 잡는다."""
    spots = [DollSpot("bear", 0.0, 0.0, 0.0), DollSpot("cat", 0.08, 0.0, 0.0, 0.22)]
    grab = judge(spots, 0.0, 0.0, roll=0.99)
    assert grab.index == 1 and grab.part == "body"


# ---- 판정 (Task 9) ----


SPOTS = [DollSpot("bunny", 0.0, 0.0, 0.0), DollSpot("bunny", 0.3, 0.2, 0.0, rare="star")]


@pytest.mark.parametrize("x, part", [(0.0, "head"), (0.08, "body"), (0.12, "arm"), (-0.35, "none")])
def test_part_depends_on_distance_to_the_nearest_doll(x, part):
    assert judge(SPOTS, x, -0.0, roll=0.99).part == part


# 머리 41%·몸통 20%·팔 8% 성공에 그 자리 집게 힘(K)을 곱하고, 줄어든 만큼 놓침이 는다 (사용자 결정 2026-10-31)
def head_win_slip(k_doll: DollSpot = DollSpot("bunny", 0.0, 0.0, 0.0), tier: float = 1.0) -> tuple[float, float]:
    k = claw_strength(k_doll.x, k_doll.z)
    return 0.41 * tier * k, 0.40 + 0.41 * (1 - tier) + 0.41 * tier * (1 - k)


def test_head_odds():
    win, slip = head_win_slip()
    assert judge(SPOTS, 0.0, 0.0, win - 0.001).outcome == "win"
    assert judge(SPOTS, 0.0, 0.0, win + 0.001).outcome == "slip"
    assert judge(SPOTS, 0.0, 0.0, win + slip - 0.001).outcome == "slip"
    assert judge(SPOTS, 0.0, 0.0, win + slip + 0.001).outcome == "miss"


def test_rare_and_gold_win_less():
    rare_win, _ = head_win_slip(tier=0.5)
    gold_win, _ = head_win_slip(tier=0.3)
    assert judge([DollSpot("bear", 0, 0, 0, rare="star")], 0, 0, rare_win + 0.001).outcome == "slip"
    assert judge([DollSpot("bear", 0, 0, 0, rare="gold")], 0, 0, gold_win + 0.001).outcome == "slip"
    assert judge([DollSpot("bear", 0, 0, 0, rare="gold")], 0, 0, gold_win - 0.001).outcome == "win"


# 체형과 난이도 (설계 2026-10-31 인형 채우기 §4.5): 뚱뚱은 잘 잡히지만 들다 떨어뜨리고, 마른은 잘 빠져나가지만 잡으면 잘 나온다
def test_chubby_dolls_are_easier_to_hit_but_slip_more():
    chubby, plain = DollSpot("bear", 0, 0, 0, body="c"), DollSpot("bear", 0, 0, 0)
    assert judge([chubby], 0.06, 0, 0.99).part == "head" and judge([plain], 0.06, 0, 0.99).part == "body"
    win, slip = head_win_slip()
    assert judge([chubby], 0, 0, win + slip + 0.05).outcome == "slip"  # 놓침 + 0.10


def test_slim_dolls_slip_through_but_hold_once_lifted():
    slim = DollSpot("bear", 0, 0, 0, body="s")
    assert judge([slim], 0.115, 0, 0.0).index is None  # 팔 범위 0.14×0.8 밖
    win, slip = head_win_slip()
    assert judge([slim], 0, 0, win + slip - 0.10 + 0.01).outcome == "miss"  # 놓침 − 0.10


def test_empty_spot_always_misses():
    assert judge(SPOTS, -0.35, -0.3, roll=0.0) == Grab("miss", "none", None)


def test_unknown_kind_is_judged_as_normal():
    assert judge([DollSpot("gone-doll", 0, 0, 0)], 0, 0, roll=0.14).outcome == "win"


# 성공하면 그 자리는 비워 둔다 — 위층을 받치던 바닥 인형을 빼면 위층이 공중에 뜨지 않고 내려앉는다 (Review Focus 3)
def test_taking_a_supporting_doll_settles_the_top():
    floor = [DollSpot("bear", -0.12, 0, 0), DollSpot("bear", 0.12, 0, 0)]
    top = DollSpot("bear", 0, 0, 0, y=rest_height(floor, 0, 0))
    after = take_out(floor + [top], 0)
    assert len(after) == 2 and after[-1].y < top.y


def test_taking_a_doll_keeps_the_others_as_they_were():
    spots = generate_stock("chick", random.Random(3)).dolls
    floor_free = next(i for i, s in enumerate(spots) if s.y == 0 and not any(t.y > 0 and math.hypot(t.x - s.x, t.z - s.z) < 0.2 for t in spots))
    after = take_out(spots, floor_free)
    assert after == [s for i, s in enumerate(spots) if i != floor_free]


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
    spots = generate_stock("bunny", random.Random(seed)).dolls
    top = next(i for i, s in enumerate(spots) if s.y > 0)
    after = drop_nearby(spots, top, random.Random(seed + 100))
    moved, was = after[top], spots[top]
    assert (moved.kind, moved.uid, moved.color, moved.body, moved.face, moved.rare) == (was.kind, was.uid, was.color, was.body, was.face, was.rare)  # 같은 인형이 자리만 바뀐다
    assert 0.04 <= math.hypot(moved.x - was.x, moved.z - was.z) <= 0.17
    w, d = MACHINE_SPEC.play_half
    assert abs(moved.x) <= w and abs(moved.z) <= d
    assert [s for i, s in enumerate(after) if i != top] == [s for i, s in enumerate(spots) if i != top]


def test_a_floor_doll_holding_others_falls_back_to_its_place():
    """위층을 받치던 바닥 인형은 굴러가면 위층이 뜨므로 제자리로 떨어진다."""
    spots = [DollSpot("bear", 0.0, 0.0, 0.0), DollSpot("cat", 0.24, 0.0, 0.0), DollSpot("dog", 0.12, 0.0, 0.0, 0.2)]
    after = drop_nearby(spots, 0, random.Random(1))
    assert (after[0].x, after[0].z, after[0].y) == (0.0, 0.0, 0.0)


# ---- 확률·집게 힘 조정 (사용자 결정 2026-10-31): 보통 인형 머리를 노리면 10판에 3~4번, 구멍에서 멀수록 집게 힘이 세다 ----
from dataclasses import replace  # noqa: E402

from toycrane.domain.crane import claw_strength  # noqa: E402


def _covered(s: DollSpot, dolls: list[DollSpot]) -> bool:
    return any(t.y > s.y and math.hypot(t.x - s.x, t.z - s.z) < 0.17 for t in dolls)


def aim_rate(aim_off: float = 0.0, look: dict | None = None, trials: int = 6000, seed: int = 7) -> float:
    """실제 판처럼: 위가 막히지 않은 인형 하나를 골라 (aim_off만큼 비켜) 노리고, 흔들림을 거쳐 판정한다."""
    rng, wins, n = random.Random(seed), 0, 0
    while n < trials:
        dolls = generate_stock("bear", rng).dolls
        open_ = [i for i, s in enumerate(dolls) if not s.rare and not _covered(s, dolls)]
        i = rng.choice(open_)
        if look:
            dolls[i] = replace(dolls[i], **look)
        angle = rng.uniform(0, 2 * math.pi)
        x, z = clamp_claw(*sway(dolls[i].x + math.cos(angle) * aim_off, dolls[i].z + math.sin(angle) * aim_off, rng))
        wins += judge(dolls, x, z, rng.random()).outcome == "win"
        n += 1
    return wins / n


def test_head_aim_wins_three_or_four_in_ten():
    assert 0.30 <= aim_rate() <= 0.40


def test_body_aim_wins_about_half_as_often():
    assert 0.13 <= aim_rate(aim_off=0.08) <= 0.22


def test_rare_wins_about_half_and_gold_a_third():
    assert 0.13 <= aim_rate(look={"rare": "star"}) <= 0.22
    assert 0.08 <= aim_rate(look={"rare": "gold"}) <= 0.15


def test_claw_strength_grows_with_distance_from_the_hole():
    hx, hz, hr = MACHINE_SPEC.hole
    w, d = MACHINE_SPEC.play_half
    assert claw_strength(hx + hr, hz) == pytest.approx(0.75)
    assert claw_strength(w, -d) == pytest.approx(1.25)  # 구멍에서 가장 먼 모서리
    assert claw_strength(hx + hr, hz) < claw_strength(0.0, 0.0) < claw_strength(w, -d)


def test_far_dolls_hold_better_than_near_ones():
    hx, hz, hr = MACHINE_SPEC.hole
    w, d = MACHINE_SPEC.play_half
    near, far = DollSpot("bear", hx + hr + 0.02, hz, 0.0), DollSpot("bear", w - 0.02, -d + 0.02, 0.0)
    roll = 0.40
    assert judge([near], near.x, near.z, roll).outcome == "slip"
    assert judge([far], far.x, far.z, roll).outcome == "win"

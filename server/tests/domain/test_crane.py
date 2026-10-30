import math
import random

from toycrane.domain.catalog import DOLLS
from toycrane.domain.crane import generate_contents
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


# ---- 판정 (Task 9) ----
import pytest  # noqa: E402

from toycrane.domain.crane import DollSpot, Grab, clamp_claw, judge, restock  # noqa: E402

SPOTS = [DollSpot("bunny", 0.0, 0.0, 0.0), DollSpot("starbunny", 0.3, 0.2, 0.0)]


@pytest.mark.parametrize("x, part", [(0.0, "head"), (0.08, "body"), (0.12, "arm"), (-0.35, "none")])
def test_part_depends_on_distance_to_the_nearest_doll(x, part):
    assert judge(SPOTS, x, -0.0, roll=0.99).part == part


@pytest.mark.parametrize("roll, outcome", [(0.39, "win"), (0.79, "slip"), (0.81, "miss")])
def test_head_odds(roll, outcome):
    assert judge(SPOTS, 0.0, 0.0, roll).outcome == outcome


def test_rare_wins_less_and_slips_more():
    assert judge(SPOTS, 0.3, 0.2, roll=0.15).outcome == "slip"  # 0.40×0.35 = 0.14
    assert judge(SPOTS, 0.3, 0.2, roll=0.13).outcome == "win"


def test_empty_spot_always_misses():
    assert judge(SPOTS, -0.35, -0.3, roll=0.0) == Grab("miss", "none", None)


def test_unknown_kind_is_judged_as_normal():
    assert judge([DollSpot("gone-doll", 0, 0, 0)], 0, 0, roll=0.39).outcome == "win"


def test_restock_keeps_nine_from_the_same_set():
    spots = generate_contents("dream", random.Random(3))
    after = restock(spots, 0, "dream", random.Random(4))
    assert len(after) == 9 and after[:8] == spots[1:] and all(DOLLS[s.kind].set == "dream" for s in after)


def test_claw_is_clamped_into_the_play_area():
    assert clamp_claw(5.0, -5.0) == (0.44, -0.38)

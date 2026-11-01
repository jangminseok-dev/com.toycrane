"""고리 걸기 상자 규칙(설계 2026-11-02 ring-hook §3, 계획 12 Task 7): 판 보고 확인·판 뒤 상자·직원 다시 세우기 — 화면 sim/hook.test.ts와 같은 규칙."""

import math
import random

from toycrane.domain.figure import FigureState
from toycrane.domain.hook import HOOK_RULES, after_play, check_report, is_lying, start_box
from toycrane.domain.layout import RINGS
from toycrane.domain.shared_data import HOOK

SHELF, BOX, STUCK = HOOK["shelf"], HOOK["box"], HOOK["stuck"]
UP = (0.0, SHELF["y"] + BOX["h"] / 2, -0.1, 0.0, 0.0, 0.0, 1.0)
s = math.sqrt(0.5)
LYING = (0.0, SHELF["y"] + BOX["d"] / 2, -0.1, s, 0.0, 0.0, s)  # x축으로 90° — 옆으로 누움
FELL = (0.0, SHELF["y"] - BOX["h"], 0.3, 0.0, 0.0, 0.0, 1.0)


def test_hook_rules_cover_ring_machines_in_zone_ring():
    assert HOOK_RULES.machines == tuple(RINGS) and HOOK_RULES.zone == "ring"


def test_start_box_stands_on_the_shelf_near_the_back():
    b = start_box(random.Random(1), "R-1")
    assert abs(b[1] - (SHELF["y"] + BOX["h"] / 2)) < 1e-9 and abs(b[2] - HOOK["start"]["z"]) <= HOOK["start"]["shift"] + 1e-9


def test_hook_win_on_the_shelf_is_refused():
    assert check_report(UP, True, "R-1") == "won"


def test_hook_miss_below_the_shelf_is_refused():
    assert check_report(FELL, False, "R-1") == "won"


def test_hook_report_is_clamped_inside_the_walls():
    box, won = check_report((5.0, UP[1], -5.0, 0.0, 0.0, 0.0, 2.0), False, "R-1")
    assert abs(box[0]) <= SHELF["half_x"] and box[2] >= SHELF["back_z"] and abs(math.hypot(*box[3:]) - 1) < 1e-9 and not won


def test_bad_hook_report_is_refused():
    assert check_report((0.0, float("nan"), 0.0, 0.0, 0.0, 0.0, 1.0), False, "R-1") == "bad"


def test_a_hook_win_gives_a_new_box():
    state, moved = after_play(FigureState(UP, 3), FELL, True, random.Random(2), "R-1")
    assert state.still == 0 and not moved and state.box[1] > SHELF["y"]


def test_a_hook_box_without_progress_is_reseated():
    state = FigureState(UP, 0)
    for _ in range(STUCK["plays"] - 1):
        state, moved = after_play(state, UP, False, random.Random(3), "R-1")
        assert not moved
    state, moved = after_play(state, UP, False, random.Random(3), "R-1")
    assert moved and state.still == 0


def test_progress_toward_the_exit_resets_the_count():
    near = (UP[0], UP[1], UP[2] + STUCK["progress"] + 0.01, *UP[3:])
    state, _ = after_play(FigureState(UP, STUCK["plays"] - 1), near, False, random.Random(4), "R-1")
    assert state.still == 0 and state.box == near


def test_a_lying_hook_box_is_reseated_after_a_few_plays():
    assert is_lying(LYING) and not is_lying(UP)
    state = FigureState(UP, 0)
    for i in range(STUCK["lying_plays"]):
        state, moved = after_play(state, LYING, False, random.Random(5), "R-1")
    assert moved and not is_lying(state.box)

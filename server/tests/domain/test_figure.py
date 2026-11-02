"""9단계 피규어 뽑기 서버 규칙(설계 2026-11-01-toycrane-figure-machine-design.md §3.2·§4): 처음 상자, 경품, 보고 확인, 꽉 낀 상자."""

import math
import random
from collections import Counter

from toycrane.domain.catalog import DOLLS, EFFECTS
from toycrane.domain.figure import FigureState, after_play, check_report, roll_prize, start_box
from toycrane.domain.shared_data import FIGURE

BARS, VARIANTS = FIGURE["bars"], FIGURE["variants"]
KINDS = ("long", "square")  # 큰 상자 두 종류(설계 §8)
BOX = VARIANTS["long"]["box"]
LYING_Y = BARS["y"] + BARS["radius"] + BOX["d"] / 2


def guards(kind: str) -> dict:
    """앞뒤 막힘: 뒤는 두 종류 같고 앞(받침 막대·유리 벽)은 상자 종류마다(figure.json variants.guards)."""
    return {**FIGURE["guards"], **VARIANTS[kind]["guards"]}


def lying_y(kind: str) -> float:
    return BARS["y"] + BARS["radius"] + VARIANTS[kind]["box"]["d"] / 2


def bar_z(kind: str) -> float:
    return VARIANTS[kind]["gap"] / 2 + BARS["radius"]


def yaw_of(box) -> float:
    _, _, _, qx, qy, qz, qw = box
    return math.degrees(2 * math.atan2(qy, qw))


def shifted(box, dx=0.0, dz=0.0, dyaw_deg=0.0):
    x, y, z, qx, qy, qz, qw = box
    a = math.radians(yaw_of(box) + dyaw_deg) / 2
    return (x + dx, y, z + dz, 0.0, math.sin(a), 0.0, math.cos(a))


def test_start_box_lies_across_both_bars():
    jit = FIGURE["start_jitter"]
    for kind in KINDS:
      for seed in range(20):
        b = start_box(random.Random(seed), kind)
        assert abs(b[0]) <= jit["shift"] and abs(b[2]) <= jit["shift"]
        assert math.isclose(b[1], lying_y(kind), abs_tol=1e-6)  # 그림 면 위로 눕힘(두께 d가 위아래)
        assert abs(yaw_of(b)) <= jit["twist_deg"] + 1e-6
        assert math.isclose(math.hypot(*b[3:]), 1.0, abs_tol=1e-6)


def test_roll_prize_odds():
    rng, n = random.Random(1), 200_000
    rolls = [roll_prize(rng) for _ in range(n)]
    rare = Counter(r for _, r in rolls)
    assert 0.004 <= rare["gold"] / n <= 0.006
    effects = {r for r in rare if r not in ("", "gold")}
    assert effects == set(EFFECTS)
    assert 0.027 <= sum(rare[e] for e in effects) / n <= 0.033
    kinds = Counter(k for k, _ in rolls)
    assert set(kinds) == set(DOLLS)
    assert all(0.035 <= kinds[k] / n <= 0.048 for k in DOLLS)


def test_check_report_rejects_bad_numbers():
    assert check_report((0.0, LYING_Y, float("nan"), 0, 0, 0, 1), False, "long") == "bad"
    assert check_report((0.0, LYING_Y, 0.0, 0, 0, 0, float("inf")), False, "long") == "bad"
    assert check_report((0.0, LYING_Y, 0.0, 0, 0, 0, 0), False, "long") == "bad"


def test_check_report_clamps_inside_machine():
    # 실제로 갈 수 있는 곳 안으로(최종 리뷰 M5): 옆은 막대 끝, 앞은 앞판, 뒤는 뒤 벽, 안 빠진 상자는 막대 위 상자 길이까지
    for kind in KINDS:
        box, won = check_report((3.0, 5.0, -3.0, 0, 0, 0, 2), False, kind)
        assert (box[0], box[2]) == (BARS["half_len"], -(bar_z(kind) + guards(kind)["back_wall"]))
        assert box[1] == BARS["y"] + VARIANTS[kind]["box"]["h"] and won is False
        assert math.isclose(math.hypot(*box[3:]), 1.0)
        box, _ = check_report((-3.0, 1.0, 3.0, 0, 0, 0, 1), False, kind)
        assert (box[0], box[2]) == (-BARS["half_len"], bar_z(kind) + guards(kind)["front_wall"])  # 앞도 뒤처럼 유리 벽까지(2026-11-02, 앞은 상자 종류마다)


def test_check_report_needs_box_below_bars_for_a_win():
    for kind in KINDS:
        h = VARIANTS[kind]["box"]["h"]
        assert check_report((0.0, lying_y(kind), 0.0, 0, 0, 0, 1), True, kind) == "won"  # 막대 위인데 빠졌다고 함
        assert check_report((0.0, BARS["y"] - h - 0.05, 0.0, 0, 0, 0, 1), False, kind) == "won"  # 막대 아래인데 안 빠졌다고 함
        box, won = check_report((0.0, BARS["y"] - h - 0.05, 0.0, 0, 0, 0, 1), True, kind)
        assert won is True


def test_stuck_box_gets_nudged():
    """여러 판 거의 안 움직인 상자는 직원이 다시 반듯이 올려놓는다(설계 §8 개정): 막대 위에 눕혀, 거의 곧게(3~7°), 앞뒤는 가운데 가까이,
    옆 자리는 그대로 — 기운 채 낀 상자를 그 자세로 살짝 옮기면 바로 빠져 공짜 당첨이 됐다(시뮬 seed 11)."""
    rng = random.Random(3)
    nudge = FIGURE["nudge"]
    q = (-0.265, 0.003, -0.011, 0.964)
    n = math.hypot(*q)
    wedged = (0.018, 1.019, 0.035, *(v / n for v in q))  # 31° 기운 채 한쪽 끝이 틈에 걸림(check_report가 정규화한 자리)
    state = FigureState(wedged, 0)
    for play in range(1, FIGURE["stuck"]["plays"] + 1):
        report = (wedged[0] + 0.001 * (-1) ** play, *wedged[1:])
        state, nudged = after_play(state, report, False, rng, "long")
        if play < FIGURE["stuck"]["plays"]:
            assert not nudged and state.still == play
    assert nudged and state.still == 0
    b = state.box
    assert math.isclose(b[1], lying_y("long"), abs_tol=1e-9)  # 막대 위에 눕힘
    assert b[3] == 0.0 and b[5] == 0.0  # 기울기 없이(요 돌림만)
    assert nudge["twist_deg"][0] - 1e-6 <= abs(yaw_of(b)) <= nudge["twist_deg"][1] + 1e-6
    assert abs(b[2]) <= nudge["shift"][1] + 1e-9  # 앞뒤는 가운데 가까이
    assert abs(b[0] - report[0]) <= nudge["shift"][1] + 1e-9  # 옆 자리는 그대로(조금 옮김)


def test_moving_box_resets_still():
    state = FigureState(start_box(random.Random(0), "long"), 5)
    state, nudged = after_play(state, shifted(state.box, dz=-0.01), False, random.Random(1), "long")
    assert state.still == 0 and not nudged


def test_win_places_a_new_box():
    for kind in KINDS:
        state = FigureState(start_box(random.Random(0), kind), 4)
        fell = (0.0, BARS["y"] - VARIANTS[kind]["box"]["h"] - 0.05, 0.0, 0, 0, 0, 1)
        state, nudged = after_play(state, fell, True, random.Random(2), kind)
        assert state.still == 0 and not nudged
        assert math.isclose(state.box[1], lying_y(kind), abs_tol=1e-6)  # 그 기계 종류의 새 상자


def test_every_figure_has_a_known_box():
    from toycrane.domain.layout import FIGURES

    assert all(f.box in KINDS for f in FIGURES.values())
    assert FIGURES["F-1"].box == "long" and FIGURES["F-8"].box == "square"

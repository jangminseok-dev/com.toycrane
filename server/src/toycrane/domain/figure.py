"""피규어 뽑기 규칙(9단계, 설계 2026-11-01-toycrane-figure-machine-design.md): 기계마다 상자 하나의 자리를 기억하고,
무엇이 들었는지는 상자가 막대 사이로 빠진 순간에 정한다. 수치는 shared/figure.json.

상자 자리(BoxPose)는 기계 좌표(앞 +z, 오른쪽 +x)의 (x, y, z, qx, qy, qz, qw) — 돌림 없음이면 긴 변이 z를 따라 그림 면 위로 눕힌 모습.
"""

import math
import random
from dataclasses import dataclass

from toycrane.domain.catalog import DOLLS, EFFECTS, GOLD
from toycrane.domain.shared_data import FIGURE

BoxPose = tuple[float, float, float, float, float, float, float]

_BARS, _BOX, _HALF = FIGURE["bars"], FIGURE["variants"]["long"]["box"], FIGURE["play_half"]  # Task 2에서 종류별
_LYING_Y = _BARS["y"] + _BARS["radius"] + _BOX["d"] / 2
_KINDS = tuple(DOLLS)


@dataclass(frozen=True)
class FigureState:
    box: BoxPose  # 지금 상자 자리(지난 판 보고, 또는 새 상자)
    still: int  # 상자가 거의 안 움직인 판이 몇 번 이어졌나(꽉 낀 상자 판단)


def _yaw(degrees: float) -> tuple[float, float, float, float]:
    a = math.radians(degrees) / 2
    return (0.0, math.sin(a), 0.0, math.cos(a))


def _mul(a: tuple[float, ...], b: tuple[float, ...]) -> tuple[float, float, float, float]:
    ax, ay, az, aw = a
    bx, by, bz, bw = b
    return (aw * bx + ax * bw + ay * bz - az * by, aw * by - ax * bz + ay * bw + az * bx, aw * bz + ax * by - ay * bx + az * bw, aw * bw - ax * bx - ay * by - az * bz)


def _turn(a: BoxPose, b: BoxPose) -> float:
    """두 상자 돌림 사이의 각(라디안)."""
    dot = abs(sum(p * q for p, q in zip(a[3:], b[3:])))
    return 2 * math.acos(min(1.0, dot))


def start_box(rng: random.Random) -> BoxPose:
    """두 막대에 반듯이 걸친 새 상자 — 매번 같은 공략이 안 되게 자리·돌림을 아주 조금 흔든다."""
    jit = FIGURE["start_jitter"]
    q = _yaw(rng.uniform(-jit["twist_deg"], jit["twist_deg"]))
    return (rng.uniform(-jit["shift"], jit["shift"]), _LYING_Y, rng.uniform(-jit["shift"], jit["shift"]), *q)


def roll_prize(rng: random.Random) -> tuple[str, str]:
    """빠진 상자에 든 피규어: (캐릭터, '' | 희귀 효과 id | 'gold') — 24종 같은 확률, 황금 0.5%, 희귀 3%."""
    kind = rng.choice(_KINDS)
    if rng.random() < FIGURE["odds"]["gold"]:
        return kind, GOLD
    if rng.random() < FIGURE["odds"]["rare"]:
        return kind, rng.choice(EFFECTS)
    return kind, ""


def check_report(box: tuple[float, ...], won: bool) -> tuple[BoxPose, bool] | str:
    """화면이 보고한 판 끝 상자 자리를 상식선에서 확인한다 — 이상하면 거절 이유("bad"·"won"), 아니면 기계 안으로 자른 자리."""
    if len(box) != 7 or not all(math.isfinite(v) for v in box):
        return "bad"
    norm = math.hypot(*box[3:])
    if norm < 1e-6:
        return "bad"
    x = max(-(_HALF[0] + 0.1), min(_HALF[0] + 0.1, box[0]))
    y = max(0.3, min(2.2, box[1]))
    z = max(-(_HALF[1] + 0.1), min(_HALF[1] + 0.1, box[2]))
    clamped: BoxPose = (x, y, z, *(v / norm for v in box[3:]))
    if won and y > _BARS["y"] - _BOX["h"] / 2:
        return "won"
    if not won and y < _BARS["y"] - _BOX["h"]:
        return "won"
    return clamped, won


def after_play(state: FigureState, box: BoxPose, won: bool, rng: random.Random) -> tuple[FigureState, bool]:
    """한 판이 끝난 뒤의 상태: 빠졌으면 새 상자, 아니면 보고한 자리. 여러 판 거의 안 움직였으면 살짝 옮긴다(직원 도움) — (새 상태, 옮겼나)."""
    if won:
        return FigureState(start_box(rng), 0), False
    stuck = FIGURE["stuck"]
    still_now = math.hypot(box[0] - state.box[0], box[2] - state.box[2]) < stuck["move"] and _turn(box, state.box) < stuck["turn"]
    still = state.still + 1 if still_now else 0
    if still < stuck["plays"]:
        return FigureState(box, still), False
    nudge = FIGURE["nudge"]
    a, d = rng.uniform(0, 2 * math.pi), rng.uniform(*nudge["shift"])
    twist = rng.uniform(*nudge["twist_deg"]) * rng.choice((-1, 1))
    q = _mul(_yaw(twist), box[3:])
    return FigureState((box[0] + math.cos(a) * d, box[1], box[2] + math.sin(a) * d, *q), 0), True

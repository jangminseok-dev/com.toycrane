"""고리 걸기 상자 규칙(설계 2026-11-02 ring-hook §3, 계획 12 Task 7) — 화면(client/src/physics/hookWorld.ts, sim/hook.test.ts)과 같은 수치(shared/hook.json).
평평한 선반 위에 세운 상자 하나, 출구는 선반 앞. 경품은 피규어와 같이 빠진 순간 정한다(figure.roll_prize)."""

import math
import random

from toycrane.domain.box_rules import BoxRules
from toycrane.domain.figure import BoxPose, FigureState
from toycrane.domain.layout import RINGS
from toycrane.domain.shared_data import HOOK

_SHELF, _EXIT, _BOX, _START, _STUCK = HOOK["shelf"], HOOK["exit"], HOOK["box"], HOOK["start"], HOOK["stuck"]


def _yaw(degrees: float) -> tuple[float, float, float, float]:
    a = math.radians(degrees) / 2
    return (0.0, math.sin(a), 0.0, math.cos(a))


def start_box(rng: random.Random, machine_id: str) -> BoxPose:
    """선반 가운데 뒤쪽에 세운 새 상자 — 자리·돌림을 조금 흔든다(화면 hookStart와 같은 범위)."""
    shift = _START["shift"]
    return (rng.uniform(-shift, shift), _SHELF["y"] + _BOX["h"] / 2, _START["z"] + rng.uniform(-shift, shift), *_yaw(rng.uniform(-_START["twist_deg"], _START["twist_deg"])))


def is_lying(box: BoxPose) -> bool:
    """쓰러졌나: 상자 위쪽(y축)이 45°보다 더 누움 — 고리가 위를 못 봐 걸 수 없다."""
    _, _, _, qx, _, qz, _ = box
    return 1 - 2 * (qx * qx + qz * qz) < math.sqrt(0.5)


def check_report(box: tuple[float, ...], won: bool, machine_id: str) -> tuple[BoxPose, bool] | str:
    """화면이 보고한 판 끝 상자 자리를 상식선에서 확인 — 이상하면 거절 이유("bad"·"won"), 아니면 벽 안으로 자른 자리.
    당첨이면 상자가 선반 아래(출구)로 내려가 있어야 하고, 당첨이 아니면 선반 높이 근처에 있어야 한다."""
    if len(box) != 7 or not all(math.isfinite(v) for v in box):
        return "bad"
    norm = math.hypot(*box[3:])
    if norm < 1e-6:
        return "bad"
    x = max(-_SHELF["half_x"], min(_SHELF["half_x"], box[0]))
    y = max(0.3, min(_SHELF["y"] + _BOX["h"], box[1]))
    z = max(_SHELF["back_z"], min(_EXIT["front_z"], box[2]))
    clamped: BoxPose = (x, y, z, *(v / norm for v in box[3:]))
    if won and y > _SHELF["y"] - _BOX["d"] / 2:
        return "won"
    if not won and y < _SHELF["y"] - _BOX["h"] * 0.6:
        return "won"
    return clamped, won


def after_play(state: FigureState, box: BoxPose, won: bool, rng: random.Random, machine_id: str) -> tuple[FigureState, bool]:
    """한 판 뒤의 상태 — (새 상태, 직원이 다시 세웠나). 뽑혔으면 새 상자. 직원: 출구 쪽(+z)으로 progress만큼 못 나온 판이 plays번
    이어지거나, 쓰러진 판이 lying_plays번 이어지면 처음 자리에 반듯이 세운다(still이 그 판 수 — 쓰러짐도 셈)."""
    if won:
        return FigureState(start_box(rng, machine_id), 0), False
    lying = is_lying(box)
    still = 0 if (not lying and box[2] > state.box[2] + _STUCK["progress"]) else state.still + 1
    if still >= _STUCK["plays"] or (lying and still >= _STUCK["lying_plays"]):
        return FigureState(start_box(rng, machine_id), 0), True
    return FigureState(box, still), False


HOOK_RULES = BoxRules(machines=tuple(RINGS), zone="ring", start_box=start_box, check_report=check_report, after_play=after_play)

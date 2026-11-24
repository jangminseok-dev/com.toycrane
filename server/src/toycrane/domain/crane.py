"""크레인 기계 속 인형 (물리 뽑기 설계 2026-10-31 §4.5·§6·§9.1).

서버는 판정하지 않는다. 인형마다 자리(x, y, z)와 돌림(쿼터니언)을 기록하고, 새 인형은 (x, z)만 찍어 안 앉은 채(y None)로 둔다 —
화면들이 같은 물리로 천장에서 떨어뜨려 앉힌다. 집게 힘의 거리 배율(claw_strength)은 shared/claw.json과 같은 표를 쓴다."""

import math
import random
from dataclasses import dataclass

from toycrane.domain.layout import MACHINE_SPEC
from toycrane.domain.shared_data import CLAW

MIN_GAP = 0.22  # 떨어뜨릴 자리끼리 최소 거리(m) — 겹쳐 떨어지면 튀어 나간다
FALLBACK_GAP = 0.16
HOLE_MARGIN = 0.05  # 구멍 네모 둘레로 이만큼 더 피한다
BODY_W = {"n": 1.0, "c": 1.15, "s": 0.88}  # 체형 폭 (화면·무게 계산과 같은 값)
Quat = tuple[float, float, float, float]
UPRIGHT: Quat = (0.0, 0.0, 0.0, 1.0)
# 인형 기계 재배치(2026-11-24): 집게 가운데가 가는 범위(벽에서 edge 안쪽) — 새 인형은 이 안에만, 이 범위를 out보다 더 벗어난 앉은 인형은 못 닿는 자리
_REPOSITION = CLAW["reposition"]
REACH_HALF: tuple[float, float] = (MACHINE_SPEC.play_half[0] - _REPOSITION["edge"], MACHINE_SPEC.play_half[1] - _REPOSITION["edge"])


@dataclass(frozen=True)
class DollSpot:
    """기계 안 인형 하나: 자리(기계 안 좌표 m)·돌림(쿼터니언)과 이 인형만의 변형. y가 None이면 아직 안 앉은 인형."""

    kind: str
    x: float
    y: float | None
    z: float
    q: Quat = UPRIGHT
    color: int = 0  # 캐릭터 색 6가지 중 (희귀·황금은 쓰지 않음)
    body: str = "n"  # "n" 보통 · "c" 뚱뚱 · "s" 마른
    face: int = 0  # 표정 5가지 중
    rare: str = ""  # "" 일반 · 효과 id(희귀) · "gold"(매우 희귀)
    uid: int = 0  # 기계 안에서 이 인형을 가리키는 번호

    @property
    def settled(self) -> bool:
        return self.y is not None


def _outside_hole(x: float, z: float) -> bool:
    hx, hz, _ = MACHINE_SPEC.hole
    half = CLAW["hole"]["size"] / 2 + HOLE_MARGIN
    return abs(x - hx) > half or abs(z - hz) > half


def unreachable(d: "DollSpot") -> bool:
    """앉은 인형의 가운데가 집게 가운데 범위를 out보다 더 벗어났다(유리 쪽 띠) — 직원이 옮길 인형."""
    out = _REPOSITION["out"]
    return d.settled and (abs(d.x) > REACH_HALF[0] + out or abs(d.z) > REACH_HALF[1] + out)


def spawn_spot(spots: list[DollSpot], rng: random.Random) -> tuple[float, float]:
    """새 인형을 떨어뜨릴 (x, z): 집게가 닿는 범위 안, 구멍 네모 밖, 다른 인형과 22cm 넘게. 400번 안에 못 찾으면 16cm로, 그래도 없으면 아무 데나."""
    w, d = REACH_HALF
    for gap, tries in ((MIN_GAP, 400), (FALLBACK_GAP, 400), (0.0, 1000)):
        for _ in range(tries):
            x, z = round(rng.uniform(-w, w), 3), round(rng.uniform(-d, d), 3)
            if _outside_hole(x, z) and all(math.hypot(x - s.x, z - s.z) >= gap for s in spots):
                return x, z
    raise AssertionError("unreachable")


def claw_strength(x: float, z: float) -> float:
    """집게 힘 배율: 구멍 가장자리 1−spread → 구멍에서 가장 먼 모서리 1+spread (사용자 결정 2026-10-31 — 멀리 있는 인형은 세게, 가까운 인형은 약하게; spread는 shared/claw.json)."""
    hx, hz, hr = MACHINE_SPEC.hole
    w, d = MACHINE_SPEC.play_half
    far = max(math.hypot(cx - hx, cz - hz) for cx in (-w, w) for cz in (-d, d))
    t = min(max((math.hypot(x - hx, z - hz) - hr) / (far - hr), 0.0), 1.0)
    return 1.0 + CLAW["spread"] * (2 * t - 1)

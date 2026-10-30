"""크레인 기계 속: 인형 배치와 판정 (설계 §5.3, 수치는 2단계 계획의 [내 판단]).

판정: 집게와 가장 가까운 인형 중심까지 거리로 잡은 부위(머리·몸통·팔·빈 곳)를 정하고,
부위별 (성공, 놓침) 확률 × 희귀도로 결과를 굴린다. 나머지는 헛잡음."""

import math
import random
from dataclasses import dataclass

from toycrane.domain.catalog import is_rare, set_kinds
from toycrane.domain.layout import MACHINE_SPEC

DOLLS_PER_MACHINE = 9
RARE_CHANCE = 0.06
PART_RADII = (("head", 0.05), ("body", 0.10), ("arm", 0.14))
ODDS = {"head": (0.40, 0.40), "body": (0.25, 0.45), "arm": (0.10, 0.45)}  # (성공, 놓침)
RARE_WIN_FACTOR = 0.35  # 희귀는 성공 확률 × 0.35, 줄어든 만큼 놓침으로


@dataclass(frozen=True)
class DollSpot:
    """기계 안 인형 하나: 기계 안 좌표(m)와 몸 돌림(라디안)."""

    kind: str
    x: float
    z: float
    r: float


def generate_contents(set_id: str, rng: random.Random) -> list[DollSpot]:
    """그 세트 인형 9개를 놀이 영역 안, 상품 구멍 밖에 놓는다."""
    return [new_spot(set_id, rng) for _ in range(DOLLS_PER_MACHINE)]


def new_spot(set_id: str, rng: random.Random) -> DollSpot:
    normals, rare = set_kinds(set_id)
    w, d = MACHINE_SPEC.play_half
    hx, hz, hr = MACHINE_SPEC.hole
    while True:
        x, z = round(rng.uniform(-w, w), 3), round(rng.uniform(-d, d), 3)
        if math.hypot(x - hx, z - hz) >= hr:
            break
    kind = rare if rng.random() < RARE_CHANCE else rng.choice(normals)
    return DollSpot(kind, x, z, round(rng.uniform(0, 2 * math.pi), 2))


@dataclass(frozen=True)
class Grab:
    outcome: str  # "win" | "slip" | "miss"
    part: str  # "head" | "body" | "arm" | "none"
    index: int | None  # 집게가 노린 인형 (빈 곳이면 None)


def clamp_claw(x: float, z: float) -> tuple[float, float]:
    w, d = MACHINE_SPEC.play_half
    return min(max(x, -w), w), min(max(z, -d), d)


def judge(spots: list[DollSpot], x: float, z: float, roll: float) -> Grab:
    """roll은 0~1 난수. 목록에 없는 인형은 일반으로 본다."""
    if not spots:
        return Grab("miss", "none", None)
    index = min(range(len(spots)), key=lambda i: math.hypot(spots[i].x - x, spots[i].z - z))
    distance = math.hypot(spots[index].x - x, spots[index].z - z)
    part = next((name for name, radius in PART_RADII if distance <= radius), None)
    if part is None:
        return Grab("miss", "none", None)
    win, slip = ODDS[part]
    if is_rare(spots[index].kind):
        win, slip = win * RARE_WIN_FACTOR, slip + win * (1 - RARE_WIN_FACTOR)
    outcome = "win" if roll < win else "slip" if roll < win + slip else "miss"
    return Grab(outcome, part, index)


def restock(spots: list[DollSpot], index: int, set_id: str, rng: random.Random) -> list[DollSpot]:
    """뽑힌 인형을 빼고 같은 세트에서 하나 채운다 (나머지는 제자리)."""
    return [s for i, s in enumerate(spots) if i != index] + [new_spot(set_id, rng)]

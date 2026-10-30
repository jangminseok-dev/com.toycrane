"""크레인 기계 속: 인형 배치 만들기 (판정은 2단계 Task 9에서)."""

import math
import random
from dataclasses import dataclass

from toycrane.domain.catalog import set_kinds
from toycrane.domain.layout import MACHINE_SPEC

DOLLS_PER_MACHINE = 9
RARE_CHANCE = 0.06


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

"""매장 규칙: 정원, 매장 고르기, 바닥 경계·장애물(탑·기계·교환소), 스폰."""

import math

from toycrane.domain.layout import OBSTACLES
from toycrane.domain.shared_data import LAYOUT
from toycrane.domain.value_objects.position import Position

STORE_CAPACITY = 50
OCCUPANCY_STALE_SECONDS = 120  # 이보다 오래 갱신 안 된 인원 기록은 믿지 않는다(배포로 끊긴 접속은 "나감"이 안 남을 수 있음)
# 큰 홀(설계 2026-11-01): 화면과 같은 공용 배치 파일(shared/store_layout.json의 hall)
MAP_HALF = LAYOUT["hall"]["map_half"]          # 걸을 수 있는 반폭
TOWER_HALF = LAYOUT["hall"]["tower_half"]      # 광장 진열탑 반폭
SPAWN_RADIUS = LAYOUT["hall"]["spawn_radius"]  # 탑 둘레 스폰 링
WALK_SPEED = 3.2       # m/s
GOLDEN_ANGLE = 2.399963


def choose_store(counts: dict[int, int], max_stores: int) -> int | None:
    """1..max_stores 중 정원이 남은 가장 작은 번호. 사람이 모여 있게 앞 매장부터 채운다."""
    return next((n for n in range(1, max_stores + 1) if counts.get(n, 0) < STORE_CAPACITY), None)


def spawn_position(seed: int) -> Position:
    angle = seed * GOLDEN_ANGLE
    return Position(math.cos(angle) * SPAWN_RADIUS, math.sin(angle) * SPAWN_RADIUS)


def clamp_to_floor(p: Position) -> Position:
    """바닥 밖은 경계로 자르고, 장애물 상자 안이면 덜 파고든 축으로 가까운 변까지 밀어낸다."""
    x = min(max(p.x, -MAP_HALF), MAP_HALF)
    z = min(max(p.z, -MAP_HALF), MAP_HALF)
    for x0, z0, x1, z1 in OBSTACLES:
        if x0 < x < x1 and z0 < z < z1:
            if min(z - z0, z1 - z) <= min(x - x0, x1 - x):
                z = _push_out(z, z0, z1)
            else:
                x = _push_out(x, x0, x1)
    return Position(x, z)


def _push_out(v: float, lo: float, hi: float) -> float:
    """가까운 변으로. 두 변까지 같으면 상자 가운데 기준 부호로(−0은 음수 쪽 — 화면 movement.ts와 같게)."""
    if v - lo != hi - v:
        return lo if v - lo < hi - v else hi
    return lo if math.copysign(1.0, v - (lo + hi) / 2) < 0 else hi

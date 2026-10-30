"""매장 규칙: 정원, 매장 고르기, 바닥 경계, 스폰."""

import math

from toycrane.domain.value_objects.position import Position

STORE_CAPACITY = 50
OCCUPANCY_STALE_SECONDS = 120  # 이보다 오래 갱신 안 된 인원 기록은 믿지 않는다(배포로 끊긴 접속은 "나감"이 안 남을 수 있음)
MAP_HALF = 12.6        # 26m 매장, 벽 두께를 빼고 걸을 수 있는 반폭
TOWER_HALF = 1.3       # 허브 한가운데 전광판 탑 반폭
SPAWN_RADIUS = 2.4     # 탑 둘레 스폰 링
WALK_SPEED = 3.2       # m/s
GOLDEN_ANGLE = 2.399963


def choose_store(counts: dict[int, int], max_stores: int) -> int | None:
    """1..max_stores 중 정원이 남은 가장 작은 번호. 사람이 모여 있게 앞 매장부터 채운다."""
    return next((n for n in range(1, max_stores + 1) if counts.get(n, 0) < STORE_CAPACITY), None)


def spawn_position(seed: int) -> Position:
    angle = seed * GOLDEN_ANGLE
    return Position(math.cos(angle) * SPAWN_RADIUS, math.sin(angle) * SPAWN_RADIUS)


def clamp_to_floor(p: Position) -> Position:
    """바닥 밖은 경계로 자르고, 탑 안이면 덜 파고든 쪽 변으로 밀어낸다."""
    x = min(max(p.x, -MAP_HALF), MAP_HALF)
    z = min(max(p.z, -MAP_HALF), MAP_HALF)
    if abs(x) < TOWER_HALF and abs(z) < TOWER_HALF:
        if TOWER_HALF - abs(z) <= TOWER_HALF - abs(x):
            z = math.copysign(TOWER_HALF, z)
        else:
            x = math.copysign(TOWER_HALF, x)
    return Position(x, z)

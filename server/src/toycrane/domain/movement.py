"""이동 검증: 보낸 위치가 걷는 속도로 갈 수 있는 거리 안이면 받고, 아니면 서버가 계산한 위치로 바꾼다."""

import math

from toycrane.domain.store_rules import WALK_SPEED, clamp_to_floor
from toycrane.domain.value_objects.heading import Heading
from toycrane.domain.value_objects.position import Position

SLACK_FACTOR = 1.5   # 네트워크 지연·프레임 차이 여유
SLACK_METERS = 0.6


def accept_move(last: Position, heading: Heading, last_at: float, claimed: Position, now: float) -> Position:
    elapsed = max(now - last_at, 0.0)
    allowed = WALK_SPEED * elapsed * SLACK_FACTOR + SLACK_METERS
    if math.hypot(claimed.x - last.x, claimed.z - last.z) <= allowed:
        return clamp_to_floor(claimed)
    step = WALK_SPEED * elapsed
    return clamp_to_floor(Position(last.x + heading.dx * step, last.z + heading.dz * step))

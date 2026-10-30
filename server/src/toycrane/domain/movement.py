"""이동 검증 — 사람마다 "이동 예산"(m)을 둔다.

예산은 걷는 속도의 1.5배(지연 여유)로 시간에 따라 차오르고, 최대 2초 분량까지만 쌓인다.
보낸 위치까지의 거리가 예산 안이면 받고 그만큼 쓴다. 넘으면 예산만큼만 그쪽으로 옮긴다.
- 오래 서 있다가 매장 끝으로 순간이동하는 것은 막고(예산 상한)
- 끊겼다 몰려 도착한 메시지는 쌓인 예산으로 받아 준다(정상 플레이어를 튕기지 않음)
"""

import math

from toycrane.domain.store_rules import WALK_SPEED, clamp_to_floor
from toycrane.domain.value_objects.position import Position

SLACK_FACTOR = 1.5
BUDGET_RATE = WALK_SPEED * SLACK_FACTOR      # 4.8 m/s
START_BUDGET = 0.6                           # 들어오자마자 조금은 움직일 수 있게
BUDGET_CAP = BUDGET_RATE * 2.0 + START_BUDGET  # 10.2 m


def accept_move(last: Position, budget: float, last_at: float, claimed: Position, now: float) -> tuple[Position, float]:
    budget = min(budget + BUDGET_RATE * max(now - last_at, 0.0), BUDGET_CAP)
    dist = math.hypot(claimed.x - last.x, claimed.z - last.z)
    if dist <= budget:
        return clamp_to_floor(claimed), budget - dist
    k = budget / dist
    return clamp_to_floor(Position(last.x + (claimed.x - last.x) * k, last.z + (claimed.z - last.z) * k)), 0.0

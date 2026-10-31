from dataclasses import dataclass

from toycrane.domain.movement import START_BUDGET
from toycrane.domain.value_objects.heading import Heading
from toycrane.domain.value_objects.position import Position


@dataclass(frozen=True)
class Player:
    player_id: str
    guest_id: str
    nickname: str
    color: int
    position: Position
    heading: Heading
    updated_at: float
    budget: float = START_BUDGET  # 이동 예산(m) — domain/movement.py
    beg_room: int | None = None  # 맵에서 조르는 중이면 더 받을 수 있는 코인 수(조르기 시작 때), 아니면 None

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

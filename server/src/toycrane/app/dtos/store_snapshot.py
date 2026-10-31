from dataclasses import dataclass

from toycrane.domain.crane import DollSpot


@dataclass(frozen=True)
class StoreSnapshot:
    """들어온 사람에게 welcome과 함께 주는 매장 상태."""

    coins: int
    bag: int
    machines: dict[str, list[DollSpot]]  # 기계 id → 기계 속 인형
    plays: dict[str, str]                # 기계 id → 하는 사람 player_id

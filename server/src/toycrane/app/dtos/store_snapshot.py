from dataclasses import dataclass, field

from toycrane.domain.crane import DollSpot
from toycrane.domain.figure import BoxPose


@dataclass(frozen=True)
class StoreSnapshot:
    """들어온 사람에게 welcome과 함께 주는 매장 상태."""

    coins: int
    bag: int
    machines: dict[str, list[DollSpot]]  # 기계 id → 기계 속 인형
    plays: dict[str, str]                # 기계 id → 하는 사람 player_id
    figures: dict[str, BoxPose] = field(default_factory=dict)  # 피규어 기계 id → 상자 자리(경품 없음)

from dataclasses import dataclass, field

from toycrane.domain.crane import DollSpot
from toycrane.domain.figure import BoxPose
from toycrane.domain.staff import StaffJob


@dataclass(frozen=True)
class StoreSnapshot:
    """들어온 사람에게 welcome과 함께 주는 매장 상태."""

    coins: int
    bag: int
    machines: dict[str, list[DollSpot]]  # 기계 id → 기계 속 인형
    plays: dict[str, str]                # 기계 id → 하는 사람 player_id
    figures: dict[str, BoxPose] = field(default_factory=dict)  # 피규어 기계 id → 상자 자리(경품 없음)
    staff: dict[str, tuple[tuple[StaffJob, ...], float]] = field(default_factory=dict)  # 구역 → (직원 일들, 대기 자리로 돌아오는 시각)
    now: float = 0.0  # 서버 시각 — 화면이 직원 일정을 제 시계로 옮긴다

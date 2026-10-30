from dataclasses import dataclass


@dataclass(frozen=True)
class DropCommand:
    conn_id: str
    x: float  # 기계 안 좌표
    z: float
    now: float


@dataclass(frozen=True)
class ResultView:
    """한 판 결과 — 매장 모두가 같은 모션을 재생한다."""

    machine_id: str
    player_id: str
    x: float
    z: float
    outcome: str  # "win" | "slip" | "miss"
    part: str  # "head" | "body" | "arm" | "none"
    kind: str | None  # 노린 인형 (빈 곳이면 None)
    index: int | None = None  # 그 인형이 기계 속 배치에서 몇 번째인지 — 모든 화면이 같은 인형을 들어 올리게

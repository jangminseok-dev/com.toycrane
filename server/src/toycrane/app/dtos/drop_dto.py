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

from dataclasses import dataclass


@dataclass(frozen=True)
class QueueMember:
    """교환소 줄에 선 사람. head_since: 맨 앞이 된 시각(아직이면 None)."""

    conn_id: str
    player_id: str
    joined_at: float
    head_since: float | None


@dataclass(frozen=True)
class QueueJoinCommand:
    conn_id: str
    counter: int
    now: float


@dataclass(frozen=True)
class QueueLeaveCommand:
    conn_id: str
    now: float

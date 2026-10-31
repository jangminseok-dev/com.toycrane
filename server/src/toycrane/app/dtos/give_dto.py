from dataclasses import dataclass


@dataclass(frozen=True)
class GiveCommand:
    conn_id: str
    to: str  # 받는 사람 player_id
    n: int
    now: float

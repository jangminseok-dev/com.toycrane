from dataclasses import dataclass


@dataclass(frozen=True)
class TakeCommand:
    conn_id: str
    now: float

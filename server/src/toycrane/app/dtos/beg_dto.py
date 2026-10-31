from dataclasses import dataclass


@dataclass(frozen=True)
class BegCommand:
    conn_id: str
    on: bool
    now: float

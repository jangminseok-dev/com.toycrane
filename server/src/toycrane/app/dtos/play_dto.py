from dataclasses import dataclass


@dataclass(frozen=True)
class PlayStartCommand:
    conn_id: str
    machine_id: str
    now: float

from dataclasses import dataclass


@dataclass(frozen=True)
class MoveCommand:
    conn_id: str
    x: float
    z: float
    dx: float
    dz: float
    now: float

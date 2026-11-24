from dataclasses import dataclass


@dataclass(frozen=True)
class StaffCommand:
    conn_id: str
    machine_id: str
    now: float

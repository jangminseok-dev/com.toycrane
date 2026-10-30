from dataclasses import dataclass


@dataclass(frozen=True)
class LeaveCommand:
    conn_id: str
    store_no: int
    now: float

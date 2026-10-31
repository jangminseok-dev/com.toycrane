from dataclasses import dataclass


@dataclass(frozen=True)
class CounterBegCommand:
    conn_id: str
    counter: int
    now: float

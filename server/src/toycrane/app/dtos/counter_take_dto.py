from dataclasses import dataclass


@dataclass(frozen=True)
class CounterTakeCommand:
    conn_id: str
    counter: int
    now: float

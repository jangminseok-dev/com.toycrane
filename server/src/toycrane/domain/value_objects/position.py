from dataclasses import dataclass


@dataclass(frozen=True)
class Position:
    x: float
    z: float

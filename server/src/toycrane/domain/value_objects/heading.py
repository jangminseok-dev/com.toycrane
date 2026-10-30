from dataclasses import dataclass
from typing import ClassVar


@dataclass(frozen=True)
class Heading:
    """걷는 방향(길이 1) 또는 멈춤(0, 0)."""

    dx: float
    dz: float
    STOP: ClassVar["Heading"]


Heading.STOP = Heading(0.0, 0.0)

from abc import ABC, abstractmethod

from toycrane.domain.figure import FigureState


class FigureBoxesPort(ABC):
    """피규어 기계마다 상자 하나의 자리와 꽉 낀 판 수 (DO 저장소 — 잠들었다 깨도, 배포해도 남는다). 경품은 들어 있지 않다."""

    @abstractmethod
    async def load(self) -> dict[str, FigureState]: ...

    @abstractmethod
    async def save(self, states: dict[str, FigureState]) -> None: ...

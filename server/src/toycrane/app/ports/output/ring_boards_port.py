from abc import ABC, abstractmethod

from toycrane.domain.ring import Card


class RingBoardsPort(ABC):
    """고리 기계마다 걸이 카드(DO 저장소 — 잠들었다 깨도, 배포해도 남는다). 경품이 보이는 기계라 카드가 곧 경품이다."""

    @abstractmethod
    async def load(self) -> dict[str, tuple[Card, ...]]: ...

    @abstractmethod
    async def save(self, boards: dict[str, tuple[Card, ...]]) -> None: ...

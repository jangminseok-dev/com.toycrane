from abc import ABC, abstractmethod

from toycrane.domain.crane import DollSpot


class MachineContentsPort(ABC):
    """매장의 기계 속 인형 배치 (DO 저장소 — 잠들었다 깨도, 배포해도 남는다)."""

    @abstractmethod
    async def load(self) -> dict[str, list[DollSpot]]: ...

    @abstractmethod
    async def save(self, contents: dict[str, list[DollSpot]]) -> None: ...

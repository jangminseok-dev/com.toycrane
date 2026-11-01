from abc import ABC, abstractmethod

from toycrane.domain.pusher import Item


class PusherShelvesPort(ABC):
    """미는 뽑기 기계마다 선반 위 인형(DO 저장소 — 잠들었다 깨도, 배포해도 남는다). 경품이 보이는 기계라 인형이 곧 경품이다."""

    @abstractmethod
    async def load(self) -> dict[str, tuple[Item, ...]]: ...

    @abstractmethod
    async def save(self, shelves: dict[str, tuple[Item, ...]]) -> None: ...

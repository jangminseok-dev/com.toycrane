from abc import ABC, abstractmethod

from toycrane.app.dtos.queue_dto import QueueMember


class QueueRegistryPort(ABC):
    """교환소 줄 (접속마다 attachment에 둔다 — 창을 닫으면 저절로 빠짐)."""

    @abstractmethod
    def members(self, counter: int) -> list[QueueMember]:
        """들어온 순서대로."""

    @abstractmethod
    def counter_of(self, conn_id: str) -> int | None: ...

    @abstractmethod
    def join(self, conn_id: str, counter: int, now: float) -> None: ...

    @abstractmethod
    def remove(self, conn_id: str) -> None: ...

    @abstractmethod
    def mark_head(self, conn_id: str, now: float) -> None: ...

from abc import ABC, abstractmethod


class OccupancyPort(ABC):
    """매장별 현재 인원. 매장(DO)이 들고나기 때 쓰고, 배정이 읽는다."""

    @abstractmethod
    async def counts(self) -> dict[int, int]: ...

    @abstractmethod
    async def write(self, store_no: int, count: int, now: float) -> None: ...

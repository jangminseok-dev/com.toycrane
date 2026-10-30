from abc import ABC, abstractmethod


class OccupancyPort(ABC):
    """매장별 현재 인원. 매장(DO)이 들고나기 때 쓰고, 배정이 읽는다."""

    @abstractmethod
    async def counts(self, fresh_since: float) -> dict[int, int]:
        """fresh_since 이후에 갱신된 기록만."""

    @abstractmethod
    async def write(self, store_no: int, count: int, now: float) -> None: ...

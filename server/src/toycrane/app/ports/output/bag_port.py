from abc import ABC, abstractmethod


class BagPort(ABC):
    """게스트가 뽑은 인형 (D1). zone: "big" | "mini" | "figure"."""

    @abstractmethod
    async def total(self, guest_id: str) -> int: ...

    @abstractmethod
    async def add(self, guest_id: str, doll: str, zone: str, now: float) -> int:
        """하나 넣고 새 합계."""

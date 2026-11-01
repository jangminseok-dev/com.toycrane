from abc import ABC, abstractmethod

from toycrane.app.dtos.bag_dto import BagEntry


class BagPort(ABC):
    """게스트가 뽑은 인형 (D1): 캐릭터·색·희귀 단계(""·효과 id·"gold")마다 센다. zone: "big" | "mini" | "figure" | "ring" | "pusher"."""

    @abstractmethod
    async def total(self, guest_id: str) -> int: ...

    @abstractmethod
    async def add(self, guest_id: str, doll: str, color: int, rare: str, zone: str, now: float) -> int:
        """하나 넣고 새 합계."""

    @abstractmethod
    async def items(self, guest_id: str) -> list[BagEntry]:
        """가방 보기: 처음 뽑은 때가 늦은 것부터(없는 게스트는 빈 목록)."""

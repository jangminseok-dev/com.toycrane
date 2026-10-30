from abc import ABC, abstractmethod

from toycrane.app.dtos.guest_dto import GuestView


class GuestRepository(ABC):
    @abstractmethod
    async def insert(self, view: GuestView, now: float) -> None: ...

    @abstractmethod
    async def get(self, guest_id: str) -> GuestView | None: ...

    @abstractmethod
    async def touch(self, guest_id: str, now: float) -> None: ...

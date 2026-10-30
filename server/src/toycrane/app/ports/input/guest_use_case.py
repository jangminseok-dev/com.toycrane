from abc import ABC, abstractmethod

from toycrane.app.dtos.guest_dto import CreateGuestCommand, FindGuestQuery, GuestView


class GuestUseCase(ABC):
    @abstractmethod
    async def create(self, cmd: CreateGuestCommand) -> GuestView: ...

    @abstractmethod
    async def find(self, query: FindGuestQuery) -> GuestView | None: ...

from abc import ABC, abstractmethod

from toycrane.app.dtos.give_dto import GiveCommand


class GiveUseCase(ABC):
    @abstractmethod
    async def give(self, cmd: GiveCommand) -> None: ...

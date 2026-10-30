from abc import ABC, abstractmethod

from toycrane.app.dtos.enter_dto import EnterCommand, EnterResult


class EnterUseCase(ABC):
    @abstractmethod
    async def enter(self, cmd: EnterCommand) -> EnterResult: ...

from abc import ABC, abstractmethod

from toycrane.app.dtos.done_dto import DoneCommand


class DoneUseCase(ABC):
    @abstractmethod
    async def done(self, cmd: DoneCommand) -> None: ...

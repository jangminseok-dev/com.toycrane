from abc import ABC, abstractmethod

from toycrane.app.dtos.act_dto import ActCommand


class ActUseCase(ABC):
    @abstractmethod
    async def act(self, cmd: ActCommand) -> None: ...

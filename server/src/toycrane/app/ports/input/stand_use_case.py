from abc import ABC, abstractmethod

from toycrane.app.dtos.play_dto import StandCommand


class StandUseCase(ABC):
    @abstractmethod
    async def stand(self, cmd: StandCommand) -> None: ...

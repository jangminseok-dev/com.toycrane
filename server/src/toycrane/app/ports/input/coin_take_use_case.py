from abc import ABC, abstractmethod

from toycrane.app.dtos.take_dto import TakeCommand


class CoinTakeUseCase(ABC):
    @abstractmethod
    async def take(self, cmd: TakeCommand) -> None: ...

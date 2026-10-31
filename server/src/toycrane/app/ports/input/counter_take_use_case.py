from abc import ABC, abstractmethod

from toycrane.app.dtos.counter_take_dto import CounterTakeCommand


class CounterTakeUseCase(ABC):
    @abstractmethod
    async def take(self, cmd: CounterTakeCommand) -> None: ...

from abc import ABC, abstractmethod

from toycrane.app.dtos.counter_beg_dto import CounterBegCommand


class CounterBegUseCase(ABC):
    @abstractmethod
    async def beg(self, cmd: CounterBegCommand) -> None: ...

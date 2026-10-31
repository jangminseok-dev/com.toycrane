from abc import ABC, abstractmethod

from toycrane.app.dtos.beg_dto import BegCommand


class BegUseCase(ABC):
    @abstractmethod
    async def beg(self, cmd: BegCommand) -> None: ...

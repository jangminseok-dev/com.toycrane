from abc import ABC, abstractmethod

from toycrane.app.dtos.drop_dto import DropCommand


class DropUseCase(ABC):
    @abstractmethod
    async def drop(self, cmd: DropCommand) -> None: ...

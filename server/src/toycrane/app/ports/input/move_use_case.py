from abc import ABC, abstractmethod

from toycrane.app.dtos.move_dto import MoveCommand


class MoveUseCase(ABC):
    @abstractmethod
    async def move(self, cmd: MoveCommand) -> None: ...

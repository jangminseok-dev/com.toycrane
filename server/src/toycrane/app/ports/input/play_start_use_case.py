from abc import ABC, abstractmethod

from toycrane.app.dtos.play_dto import PlayStartCommand


class PlayStartUseCase(ABC):
    @abstractmethod
    async def start(self, cmd: PlayStartCommand) -> None: ...

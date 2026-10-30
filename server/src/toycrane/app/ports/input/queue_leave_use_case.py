from abc import ABC, abstractmethod

from toycrane.app.dtos.queue_dto import QueueLeaveCommand


class QueueLeaveUseCase(ABC):
    @abstractmethod
    async def leave(self, cmd: QueueLeaveCommand) -> None: ...

from abc import ABC, abstractmethod

from toycrane.app.dtos.queue_dto import QueueJoinCommand


class QueueJoinUseCase(ABC):
    @abstractmethod
    async def join(self, cmd: QueueJoinCommand) -> None: ...

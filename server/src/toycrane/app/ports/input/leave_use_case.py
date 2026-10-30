from abc import ABC, abstractmethod

from toycrane.app.dtos.leave_dto import LeaveCommand


class LeaveUseCase(ABC):
    @abstractmethod
    async def leave(self, cmd: LeaveCommand) -> None: ...

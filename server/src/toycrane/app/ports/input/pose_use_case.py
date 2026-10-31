from abc import ABC, abstractmethod

from toycrane.app.dtos.pose_dto import PoseCommand


class PoseUseCase(ABC):
    @abstractmethod
    async def relay(self, cmd: PoseCommand) -> None: ...

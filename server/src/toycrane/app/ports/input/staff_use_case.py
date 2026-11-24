from abc import ABC, abstractmethod

from toycrane.app.dtos.staff_dto import StaffCommand


class StaffUseCase(ABC):
    @abstractmethod
    async def call(self, cmd: StaffCommand) -> None: ...

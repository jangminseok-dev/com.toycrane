from abc import ABC, abstractmethod

from toycrane.app.dtos.manager_dto import ManagerQuery, ManagerResponse


class ManagerUseCase(ABC):
    @abstractmethod
    async def introduce_myself(self, query: ManagerQuery) -> ManagerResponse: ...

from abc import ABC, abstractmethod

from toycrane.app.dtos.bag_dto import BagEntry, ListBagQuery


class BagUseCase(ABC):
    @abstractmethod
    async def list(self, query: ListBagQuery) -> list[BagEntry]: ...

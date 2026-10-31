from abc import ABC, abstractmethod

from toycrane.app.dtos.stock_dto import StockCommand


class StockUseCase(ABC):
    @abstractmethod
    async def refill(self, cmd: StockCommand) -> None: ...

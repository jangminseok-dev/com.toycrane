from abc import ABC, abstractmethod

from toycrane.domain.entities.player import Player


class PlayerRegistryPort(ABC):
    """매장에 들어와 있는 사람들(접속 식별자 → 플레이어). 매장이 잠들었다 깨도 남아 있어야 한다."""

    @abstractmethod
    def entries(self) -> list[tuple[str, Player]]: ...

    @abstractmethod
    def put(self, conn_id: str, player: Player) -> None: ...

    @abstractmethod
    def remove(self, conn_id: str) -> Player | None: ...

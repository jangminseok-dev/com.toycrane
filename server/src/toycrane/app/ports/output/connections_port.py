from abc import ABC, abstractmethod

from toycrane.app.dtos.player_view import PlayerView
from toycrane.app.dtos.store_snapshot import StoreSnapshot


class ConnectionsPort(ABC):
    """매장 접속들에게 알리기. 메시지 형식(직렬화)은 어댑터가 정한다."""

    @abstractmethod
    def send_welcome(self, conn_id: str, store_no: int, you: PlayerView, players: list[PlayerView], snapshot: StoreSnapshot) -> None: ...

    @abstractmethod
    def broadcast_join(self, except_conn: str, p: PlayerView) -> None: ...

    @abstractmethod
    def broadcast_leave(self, except_conn: str | None, player_id: str) -> None: ...

    @abstractmethod
    def broadcast_move(self, except_conn: str, p: PlayerView) -> None: ...

    @abstractmethod
    def send_correction(self, conn_id: str, x: float, z: float) -> None: ...

    @abstractmethod
    def kick(self, conn_id: str, code: int, reason: str) -> None: ...

    @abstractmethod
    def broadcast_queue(self, counter: int, player_ids: list[str]) -> None:
        """교환소 줄 순서를 모두에게(맨 앞이 0번)."""

    @abstractmethod
    def send_queue_no(self, conn_id: str, counter: int, why: str) -> None: ...

    @abstractmethod
    def send_coins(self, conn_id: str, total: int, got: int) -> None: ...

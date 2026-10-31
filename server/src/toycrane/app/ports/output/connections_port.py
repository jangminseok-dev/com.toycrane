from abc import ABC, abstractmethod

from toycrane.app.dtos.drop_dto import ResultView
from toycrane.app.dtos.player_view import PlayerView
from toycrane.app.dtos.store_snapshot import StoreSnapshot
from toycrane.domain.crane import DollSpot


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

    @abstractmethod
    def send_play_ok(self, conn_id: str, machine_id: str, coins: int, limit: int) -> None: ...

    @abstractmethod
    def send_play_no(self, conn_id: str, machine_id: str, why: str) -> None:
        """why: "busy" | "coins" | "far" | "playing"."""

    @abstractmethod
    def broadcast_play(self, except_conn: str, machine_id: str, player_id: str) -> None: ...

    @abstractmethod
    def broadcast_result(self, view: ResultView) -> None:
        """본인 포함 모두에게."""

    @abstractmethod
    def broadcast_machine(self, machine_id: str, spots: list[DollSpot]) -> None: ...

    @abstractmethod
    def broadcast_free(self, machine_id: str) -> None: ...

    @abstractmethod
    def send_bag(self, conn_id: str, total: int) -> None: ...

    @abstractmethod
    def broadcast_spawn(self, machine_id: str, kind: str, rare: str) -> None:
        """희귀·황금이 채워졌다 — 매장 전광판에 띄운다."""

    @abstractmethod
    def broadcast_stock(self, due_in: float | None) -> None:
        """다음 채울 때까지 남은 초(가득이면 None) — 그때 화면이 tick을 보내 서버를 깨운다."""

    @abstractmethod
    def send_stock(self, conn_id: str, due_in: float | None) -> None: ...

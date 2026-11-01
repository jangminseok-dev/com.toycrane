from abc import ABC, abstractmethod

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
    def broadcast_beg(self, player_id: str, room: int | None) -> None:
        """맵 조르기 시작(room = 더 받을 수 있는 코인 수)·끝(None)을 모두에게."""

    @abstractmethod
    def broadcast_gave(self, from_id: str, to_id: str, n: int) -> None:
        """코인 주기가 이뤄졌다 — 주기·기쁨 모션과 알림."""

    @abstractmethod
    def send_give_no(self, conn_id: str, why: str) -> None:
        """주기 거절: "gone"|"stopped"|"far"|"poor"|"full"|"self"|"playing"."""

    @abstractmethod
    def send_take_no(self, conn_id: str, counter: int, why: str) -> None:
        """코인 받기 거절: "far"(창구에서 멂) | "enough"(15개 이상)."""

    @abstractmethod
    def broadcast_counter_beg(self, player_id: str, counter: int, n: int) -> None:
        """교환소 조르기 결과를 모두에게 — n개를 받음, 0이면 쿨타임 거절(시무룩)."""

    @abstractmethod
    def send_counter_beg_no(self, conn_id: str, counter: int, why: str, wait: float) -> None:
        """교환소 조르기 거절(본인에게): "wait"(wait초 뒤) | "full"(99개) | "far"."""

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
    def send_done_no(self, conn_id: str, machine_id: str, why: str) -> None:
        """판 보고 거절(치명 규칙) — 기계는 판 시작 전 그대로."""

    @abstractmethod
    def broadcast_pose(self, except_conn: str, player_id: str, machine_id: str, c: list, d: list) -> None:
        """판을 하는 사람의 집게·인형 자리 중계 — 본인 빼고 모두에게."""

    @abstractmethod
    def broadcast_result(self, machine_id: str, player_id: str, won: list[tuple[str, int, str, int]]) -> None:
        """본인 포함 모두에게."""

    @abstractmethod
    def broadcast_machine(self, machine_id: str, spots: list[DollSpot]) -> None: ...

    @abstractmethod
    def broadcast_free(self, machine_id: str) -> None: ...

    @abstractmethod
    def broadcast_figure(self, machine_id: str, box, nudged: bool) -> None:
        """피규어 기계 상자 자리를 모두에게."""

    @abstractmethod
    def broadcast_ring(self, machine_id: str, board, x: float, y: float, peg: int | None, caught: bool) -> None:
        """고리 기계 한 판(카드·찌른 자리·결과)을 모두에게."""

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

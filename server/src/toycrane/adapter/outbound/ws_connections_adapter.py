import json

from toycrane.adapter.inbound.ws.schemas import server_messages
from toycrane.adapter.outbound import ws_attachment
from toycrane.app.dtos.player_view import PlayerView
from toycrane.app.dtos.store_snapshot import StoreSnapshot
from toycrane.app.ports.output.connections_port import ConnectionsPort
from toycrane.domain.crane import DollSpot


def _encode(message: dict) -> str:
    return json.dumps(message, ensure_ascii=False, separators=(",", ":"))


class WsConnectionsAdapter(ConnectionsPort):
    """매장 웹소켓으로 메시지를 보낸다. 들어와 있는(player가 붙은) 접속에만 방송한다."""

    def __init__(self, ctx) -> None:
        self._ctx = ctx

    def _send(self, ws, message: dict) -> None:
        try:
            ws.send(_encode(message))
        except Exception:
            pass  # 닫히는 중인 소켓 — 곧 webSocketClose로 정리된다

    def _to_one(self, conn_id: str, message: dict) -> None:
        ws = ws_attachment.find(self._ctx, conn_id)
        if ws is not None:
            self._send(ws, message)

    def _to_all_except(self, except_conn: str | None, message: dict) -> None:
        for ws in ws_attachment.sockets(self._ctx):
            data = ws_attachment.read(ws)
            if data.get("player") and data.get("conn") != except_conn:
                self._send(ws, message)

    def send_welcome(self, conn_id: str, store_no: int, you: PlayerView, players: list[PlayerView], snapshot: StoreSnapshot) -> None:
        self._to_one(conn_id, server_messages.welcome(store_no, you, players, snapshot))

    def broadcast_join(self, except_conn: str, p: PlayerView) -> None:
        self._to_all_except(except_conn, server_messages.join(p))

    def broadcast_leave(self, except_conn: str | None, player_id: str) -> None:
        self._to_all_except(except_conn, server_messages.leave(player_id))

    def broadcast_move(self, except_conn: str, p: PlayerView) -> None:
        self._to_all_except(except_conn, server_messages.move(p))

    def send_correction(self, conn_id: str, x: float, z: float) -> None:
        self._to_one(conn_id, server_messages.correct(x, z))

    def broadcast_beg(self, player_id: str, room: int | None) -> None:
        self._to_all_except(None, server_messages.beg(player_id, room))

    def broadcast_gave(self, from_id: str, to_id: str, n: int) -> None:
        self._to_all_except(None, server_messages.gave(from_id, to_id, n))

    def send_give_no(self, conn_id: str, why: str) -> None:
        self._to_one(conn_id, server_messages.give_no(why))

    def send_take_no(self, conn_id: str, counter: int, why: str) -> None:
        self._to_one(conn_id, server_messages.take_no(counter, why))

    def broadcast_counter_beg(self, player_id: str, counter: int, n: int) -> None:
        self._to_all_except(None, server_messages.cbeg(player_id, counter, n))

    def send_counter_beg_no(self, conn_id: str, counter: int, why: str, wait: float) -> None:
        self._to_one(conn_id, server_messages.cbeg_no(counter, why, wait))

    def send_coins(self, conn_id: str, total: int, got: int) -> None:
        self._to_one(conn_id, server_messages.coins(total, got))

    def send_play_ok(self, conn_id: str, machine_id: str, coins: int, limit: int) -> None:
        self._to_one(conn_id, server_messages.play_ok(machine_id, coins, limit))

    def send_play_no(self, conn_id: str, machine_id: str, why: str) -> None:
        self._to_one(conn_id, server_messages.play_no(machine_id, why))

    def broadcast_play(self, except_conn: str, machine_id: str, player_id: str) -> None:
        self._to_all_except(except_conn, server_messages.play(machine_id, player_id))

    def send_done_no(self, conn_id: str, machine_id: str, why: str) -> None:
        self._to_one(conn_id, server_messages.done_no(machine_id, why))

    def broadcast_pose(self, except_conn: str, player_id: str, machine_id: str, c: list, d: list) -> None:
        self._to_all_except(except_conn, server_messages.pose(player_id, machine_id, c, d))

    def broadcast_result(self, machine_id: str, player_id: str, won: list[tuple[str, int, str, int]]) -> None:
        self._to_all_except(None, server_messages.result(machine_id, player_id, won))

    def broadcast_machine(self, machine_id: str, spots: list[DollSpot]) -> None:
        self._to_all_except(None, server_messages.machine(machine_id, spots))

    def broadcast_figure(self, machine_id: str, box, nudged: bool) -> None:
        self._to_all_except(None, server_messages.figure(machine_id, box, nudged))

    def broadcast_free(self, machine_id: str) -> None:
        self._to_all_except(None, server_messages.free(machine_id))

    def broadcast_spawn(self, machine_id: str, kind: str, rare: str) -> None:
        self._to_all_except(None, server_messages.spawn(machine_id, kind, rare))

    def broadcast_stock(self, due_in: float | None) -> None:
        self._to_all_except(None, server_messages.stock(due_in))

    def send_stock(self, conn_id: str, due_in: float | None) -> None:
        self._to_one(conn_id, server_messages.stock(due_in))

    def send_bag(self, conn_id: str, total: int) -> None:
        self._to_one(conn_id, server_messages.bag(total))

    def kick(self, conn_id: str, code: int, reason: str) -> None:
        ws = ws_attachment.find(self._ctx, conn_id)
        if ws is not None:
            try:
                ws.close(code, reason)
            except Exception:
                pass

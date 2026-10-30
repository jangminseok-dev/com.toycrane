import json

from toycrane.adapter.inbound.ws.schemas import server_messages
from toycrane.adapter.outbound import ws_attachment
from toycrane.app.dtos.player_view import PlayerView
from toycrane.app.dtos.store_snapshot import StoreSnapshot
from toycrane.app.ports.output.connections_port import ConnectionsPort


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

    def broadcast_queue(self, counter: int, player_ids: list[str]) -> None:
        self._to_all_except(None, server_messages.queue(counter, player_ids))

    def send_queue_no(self, conn_id: str, counter: int, why: str) -> None:
        self._to_one(conn_id, server_messages.queue_no(counter, why))

    def send_coins(self, conn_id: str, total: int, got: int) -> None:
        self._to_one(conn_id, server_messages.coins(total, got))

    def kick(self, conn_id: str, code: int, reason: str) -> None:
        ws = ws_attachment.find(self._ctx, conn_id)
        if ws is not None:
            try:
                ws.close(code, reason)
            except Exception:
                pass

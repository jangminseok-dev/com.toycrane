from toycrane.adapter.outbound import ws_attachment
from toycrane.app.ports.output.player_registry_port import PlayerRegistryPort
from toycrane.domain.entities.player import Player
from toycrane.domain.value_objects.heading import Heading
from toycrane.domain.value_objects.position import Position


def _to_dict(p: Player) -> dict:
    return {
        "id": p.player_id, "guest": p.guest_id, "nick": p.nickname, "color": p.color,
        "x": p.position.x, "z": p.position.z, "dx": p.heading.dx, "dz": p.heading.dz, "at": p.updated_at,
    }


def _from_dict(d: dict) -> Player:
    return Player(d["id"], d["guest"], d["nick"], d["color"], Position(d["x"], d["z"]), Heading(d["dx"], d["dz"]), d["at"])


class AttachmentPlayerRegistry(PlayerRegistryPort):
    """매장 플레이어 목록을 각 웹소켓 attachment에 둔다 — 메모리가 지워져도 getWebSockets()로 복원된다."""

    def __init__(self, ctx) -> None:
        self._ctx = ctx

    def entries(self) -> list[tuple[str, Player]]:
        out = []
        for ws in ws_attachment.sockets(self._ctx):
            data = ws_attachment.read(ws)
            if data.get("player"):
                out.append((data["conn"], _from_dict(data["player"])))
        return out

    def put(self, conn_id: str, player: Player) -> None:
        ws = ws_attachment.find(self._ctx, conn_id)
        if ws is not None:
            ws_attachment.write(ws, {**ws_attachment.read(ws), "player": _to_dict(player)})

    def remove(self, conn_id: str) -> Player | None:
        ws = ws_attachment.find(self._ctx, conn_id)
        if ws is None:
            return None
        data = ws_attachment.read(ws)
        gone = data.pop("player", None)
        ws_attachment.write(ws, data)
        return _from_dict(gone) if gone else None

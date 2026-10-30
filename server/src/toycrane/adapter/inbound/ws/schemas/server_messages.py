"""서버→화면 메시지 형식. 견본: shared/protocol_fixtures.json. 위치는 소수 2자리, 방향은 3자리로 줄여 보낸다."""

from toycrane.app.dtos.player_view import PlayerView


def _player(p: PlayerView) -> dict:
    return {"id": p.id, "nick": p.nick, "color": p.color, **_pose(p)}


def _pose(p: PlayerView) -> dict:
    return {"x": round(p.x, 2), "z": round(p.z, 2), "dx": round(p.dx, 3), "dz": round(p.dz, 3)}


def welcome(store_no: int, you: PlayerView, players: list[PlayerView]) -> dict:
    return {"t": "welcome", "store": store_no, "you": _player(you), "players": [_player(p) for p in players]}


def join(p: PlayerView) -> dict:
    return {"t": "join", "p": _player(p)}


def leave(player_id: str) -> dict:
    return {"t": "leave", "id": player_id}


def move(p: PlayerView) -> dict:
    return {"t": "move", "id": p.id, **_pose(p)}


def correct(x: float, z: float) -> dict:
    return {"t": "correct", "x": round(x, 2), "z": round(z, 2)}

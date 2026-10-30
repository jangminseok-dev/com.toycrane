"""서버→화면 메시지 형식. 견본: shared/protocol_fixtures.json. 위치는 소수 2자리, 방향은 3자리로 줄여 보낸다.
기계 속 인형은 [id, x, z, r, y] — 기계 안 좌표·얹힌 높이 소수 3자리, 몸 돌림 2자리."""

from toycrane.app.dtos.drop_dto import ResultView
from toycrane.app.dtos.player_view import PlayerView
from toycrane.app.dtos.store_snapshot import StoreSnapshot
from toycrane.domain.crane import DollSpot


def _player(p: PlayerView) -> dict:
    return {"id": p.id, "nick": p.nick, "color": p.color, **_pose(p)}


def _pose(p: PlayerView) -> dict:
    return {"x": round(p.x, 2), "z": round(p.z, 2), "dx": round(p.dx, 3), "dz": round(p.dz, 3)}


def _spots(spots: list[DollSpot]) -> list[list]:
    return [[s.kind, round(s.x, 3), round(s.z, 3), round(s.r, 2), round(s.y, 3)] for s in spots]


def welcome(store_no: int, you: PlayerView, players: list[PlayerView], snapshot: StoreSnapshot) -> dict:
    return {
        "t": "welcome", "store": store_no, "you": _player(you), "players": [_player(p) for p in players],
        "coins": snapshot.coins, "bag": snapshot.bag,
        "machines": {m: _spots(spots) for m, spots in snapshot.machines.items()},
        "queues": snapshot.queues, "plays": snapshot.plays,
    }


def join(p: PlayerView) -> dict:
    return {"t": "join", "p": _player(p)}


def leave(player_id: str) -> dict:
    return {"t": "leave", "id": player_id}


def move(p: PlayerView) -> dict:
    return {"t": "move", "id": p.id, **_pose(p)}


def correct(x: float, z: float) -> dict:
    return {"t": "correct", "x": round(x, 2), "z": round(z, 2)}


def queue(counter: int, player_ids: list[str]) -> dict:
    return {"t": "queue", "c": counter, "ids": player_ids}


def queue_no(counter: int, why: str) -> dict:
    return {"t": "queue_no", "c": counter, "why": why}


def coins(total: int, got: int) -> dict:
    return {"t": "coins", "n": total, "got": got}


def play_ok(machine_id: str, coins: int, limit: int) -> dict:
    return {"t": "play_ok", "m": machine_id, "coins": coins, "limit": limit}


def play_no(machine_id: str, why: str) -> dict:
    return {"t": "play_no", "m": machine_id, "why": why}


def play(machine_id: str, player_id: str) -> dict:
    return {"t": "play", "m": machine_id, "id": player_id}


def result(v: ResultView) -> dict:
    return {
        "t": "result", "m": v.machine_id, "id": v.player_id, "x": round(v.x, 3), "z": round(v.z, 3),
        "o": v.outcome, "part": v.part, "k": v.kind, "i": v.index,
    }


def machine(machine_id: str, spots: list[DollSpot]) -> dict:
    return {"t": "machine", "m": machine_id, "dolls": _spots(spots)}


def free(machine_id: str) -> dict:
    return {"t": "free", "m": machine_id}


def bag(total: int) -> dict:
    return {"t": "bag", "n": total}

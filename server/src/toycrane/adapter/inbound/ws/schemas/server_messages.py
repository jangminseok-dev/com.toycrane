"""서버→화면 메시지 형식. 견본: shared/protocol_fixtures.json. 위치는 소수 2자리, 방향은 3자리로 줄여 보낸다.
기계 속 인형은 [캐릭터, x, y|null, z, qx, qy, qz, qw, 색, 체형, 표정, 희귀, 번호] — 자리·돌림 소수 3자리, y가 None이면 아직 안 앉은 인형
(물리 뽑기 설계 §4.5)."""

import math

from toycrane.app.dtos.player_view import PlayerView
from toycrane.app.dtos.store_snapshot import StoreSnapshot
from toycrane.domain.crane import DollSpot

PROTOCOL = 18  # 메시지 형식 버전 — 화면(net/protocol.ts PROTOCOL)과 다르면 화면이 새로고침한다


def _player(p: PlayerView) -> dict:
    return {"id": p.id, "nick": p.nick, "color": p.color, **_pose(p), "beg": p.beg}


def _pose(p: PlayerView) -> dict:
    return {"x": round(p.x, 2), "z": round(p.z, 2), "dx": round(p.dx, 3), "dz": round(p.dz, 3)}


def _spots(spots: list[DollSpot]) -> list[list]:
    return [
        [s.kind, round(s.x, 3), None if s.y is None else round(s.y, 3), round(s.z, 3), *(round(v, 3) for v in s.q), s.color, s.body, s.face, s.rare, s.uid]
        for s in spots
    ]


def welcome(store_no: int, you: PlayerView, players: list[PlayerView], snapshot: StoreSnapshot) -> dict:
    return {
        "t": "welcome", "v": PROTOCOL, "store": store_no, "you": _player(you), "players": [_player(p) for p in players],
        "coins": snapshot.coins, "bag": snapshot.bag,
        "machines": {m: _spots(spots) for m, spots in snapshot.machines.items()},
        "plays": snapshot.plays,
        "figures": {m: _box(b) for m, b in snapshot.figures.items()},
        "staff": {z: {"jobs": [_job(j) for j in jobs], "back": round(back, 3)} for z, (jobs, back) in snapshot.staff.items()},
        "now": round(snapshot.now, 3),
    }


def _box(b) -> list[float]:
    return [round(v, 3) for v in b]


def figure(machine_id: str, box, nudged: bool) -> dict:
    """피규어 기계 상자 자리(판이 끝난 뒤·새 상자·직원이 옮긴 뒤) — 경품은 담지 않는다."""
    return {"t": "figure", "m": machine_id, "box": _box(box), "nudged": nudged}


def join(p: PlayerView) -> dict:
    return {"t": "join", "p": _player(p)}


def leave(player_id: str) -> dict:
    return {"t": "leave", "id": player_id}


def move(p: PlayerView) -> dict:
    return {"t": "move", "id": p.id, **_pose(p)}


def correct(x: float, z: float) -> dict:
    return {"t": "correct", "x": round(x, 2), "z": round(z, 2)}


def beg(player_id: str, room: int | None) -> dict:
    return {"t": "beg", "id": player_id, "room": room}


def gave(from_id: str, to_id: str, n: int) -> dict:
    return {"t": "gave", "from": from_id, "to": to_id, "n": n}


def give_no(why: str) -> dict:
    return {"t": "give_no", "why": why}


def take_no(counter: int, why: str) -> dict:
    return {"t": "take_no", "c": counter, "why": why}


def cbeg(player_id: str, counter: int, n: int) -> dict:
    return {"t": "cbeg", "id": player_id, "c": counter, "n": n}


def cbeg_no(counter: int, why: str, wait: float) -> dict:
    return {"t": "cbeg_no", "c": counter, "why": why, "wait": math.ceil(wait)}


def coins(total: int, got: int) -> dict:
    return {"t": "coins", "n": total, "got": got}


def play_ok(machine_id: str, coins: int, limit: int) -> dict:
    return {"t": "play_ok", "m": machine_id, "coins": coins, "limit": limit}


def play_no(machine_id: str, why: str) -> dict:
    return {"t": "play_no", "m": machine_id, "why": why}


def play(machine_id: str, player_id: str) -> dict:
    return {"t": "play", "m": machine_id, "id": player_id}


def result(machine_id: str, player_id: str, won: list[tuple[str, int, str, int]], staff: bool = False, miss: int = 0, tidied: int = 0) -> dict:
    """한 판 결과: 구멍에 빠진 인형들 [캐릭터, 색, 희귀, 번호] (판을 한 화면이 보고, 서버는 확인해 중계).
    staff: 미는 뽑기 15판 보장으로 직원이 꺼내 준 인형이 든 결과(있을 때만 실음). miss: 그 사람이 이 기계에서 연달아 못 뽑은 판 수(있을 때만 —
    화면이 '집게가 세지기까지 N판'·'직원 도움까지 N판'을 알리고, 인형 기계는 claw.json help.plays판부터 센 집게로 한다).
    tidied: 직원이 턱 앞에 걸린 인형을 뒤로 옮긴 수(미는 뽑기, 있을 때만)."""
    return ({"t": "result", "m": machine_id, "id": player_id, "won": [list(w) for w in won]} | ({"staff": True} if staff else {}) | ({"miss": miss} if miss else {})
            | ({"tidied": tidied} if tidied else {}))


def done_no(machine_id: str, why: str) -> dict:
    return {"t": "done_no", "m": machine_id, "why": why}


def _job(j) -> dict:
    return {"m": j.machine, "from": j.origin, "dep": round(j.depart, 3), "arr": round(j.arrive, 3), "put": round(j.put, 3), "end": round(j.end, 3)}


def staff_plan(zone: str, jobs, back: float, now: float, machine_id: str, dolls: list[DollSpot] | None = None, box=None) -> dict:
    """상주 직원 일정(설계 2026-11-24 store-staff): 그 구역 직원의 일들과 대기 자리로 돌아오는 시각, 이번 일(machine_id)의 다시 놓은 결과 —
    인형 기계·미는 뽑기는 dolls, 피규어·고리 걸기는 box. 화면은 put 시각에 결과를 그린다."""
    msg = {"t": "staff_plan", "now": round(now, 3), "z": zone, "jobs": [_job(j) for j in jobs], "back": round(back, 3), "m": machine_id}
    if dolls is not None:
        msg["dolls"] = _spots(dolls)
    if box is not None:
        msg["box"] = _box(box)
    return msg


def staff_no(machine_id: str, why: str, left: int) -> dict:
    """직원 부르기 거절(본인에게): "wait"(left판 더) · "busy"(줄이 참) · "again"(그 기계에 일이 있음) · "seat"(판 사이 자리가 아님)."""
    return {"t": "staff_no", "m": machine_id, "why": why, "left": left}


def pose(player_id: str, machine_id: str, f: list) -> dict:
    """판을 하는 사람의 집게·움직이는 인형 중계 묶음 f = [[나이, 집게, 인형들], …] — 받은 그대로 뿌린다."""
    return {"t": "pose", "m": machine_id, "id": player_id, "f": [[age, list(c), [list(x) for x in d]] for age, c, d in f]}


def machine(machine_id: str, spots: list[DollSpot]) -> dict:
    return {"t": "machine", "m": machine_id, "dolls": _spots(spots)}


def spawn(machine_id: str, kind: str, rare: str) -> dict:
    return {"t": "spawn", "m": machine_id, "k": kind, "rv": rare}


def stock(due_in: float | None) -> dict:
    return {"t": "stock", "in": None if due_in is None else math.ceil(due_in * 10) / 10}  # 올림: tick이 채울 시각보다 먼저 오지 않게


def free(machine_id: str) -> dict:
    return {"t": "free", "m": machine_id}


def bag(total: int) -> dict:
    return {"t": "bag", "n": total}

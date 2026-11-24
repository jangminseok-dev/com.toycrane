"""상주 직원 (설계 2026-11-24 store-staff): 구역마다 한 명이 대기 자리에 서 있다가, 판 사이에 부른 손님의 기계 옆까지 걸어가 기계 안을 전부 다시 놓는다.

서버는 부를 때 일정(출발·도착·다시 놓기·끝 시각)을 정하고 화면은 그 일정대로 같은 길찾기로 그린다. 걷는 시간은 직선 거리 × route_factor / speed."""

import math

from toycrane.domain.layout import FIGURES, MACHINES, PUSHERS, RINGS, front_spot, machine_spot
from toycrane.domain.shared_data import STAFF

Point = tuple[float, float]


def zone_of(machine_id: str) -> str | None:
    """기계가 속한 구역: 인형 기계 'doll', 피규어 'figure', 고리 걸기 'hook', 미는 뽑기 'pusher'."""
    if machine_id in MACHINES:
        return "doll"
    if machine_id in FIGURES:
        return "figure"
    if machine_id in RINGS:
        return "hook"
    if machine_id in PUSHERS:
        return "pusher"
    return None


def post_of(zone: str) -> Point:
    x, z = STAFF["posts"][zone]
    return (x, z)


def side_spot(machine_id: str) -> Point:
    """직원이 일하는 자리: 기계 앞자리에서 기계를 보는 손님의 왼쪽으로 side m(기계 앞 화면의 왼쪽 끝)."""
    m = machine_spot(machine_id)
    assert m is not None
    f = front_spot(m)
    return (f.x - math.cos(m.ry) * STAFF["side"], f.z + math.sin(m.ry) * STAFF["side"])


def walk_seconds(a: Point, b: Point) -> float:
    t = math.hypot(b[0] - a[0], b[1] - a[1]) * STAFF["route_factor"] / STAFF["speed"]
    return min(max(t, STAFF["walk_min"]), STAFF["walk_max"])

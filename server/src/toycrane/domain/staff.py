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
    """직원이 일하는 자리: 기계 앞자리에서 기계를 보는 손님의 왼쪽으로 side[구역] m, 기계 쪽으로 inset m — 기계 앞면 바로 옆(카메라 앞을 가리지 않게)."""
    m, zone = machine_spot(machine_id), zone_of(machine_id)
    assert m is not None and zone is not None
    f, side, inset = front_spot(m), STAFF["side"][zone], STAFF["inset"]
    return (f.x - math.cos(m.ry) * side - math.sin(m.ry) * inset, f.z + math.sin(m.ry) * side - math.cos(m.ry) * inset)


def walk_seconds(a: Point, b: Point) -> float:
    t = math.hypot(b[0] - a[0], b[1] - a[1]) * STAFF["route_factor"] / STAFF["speed"]
    return min(max(t, STAFF["walk_min"]), STAFF["walk_max"])


# --- 일정·줄·5판 세기 ---
from dataclasses import dataclass, field, replace  # noqa: E402

CALLS_KEEP = 40  # 기계마다 최근에 부른 손님 수만 기억(stock.MISS_KEEP과 같은 생각)


@dataclass(frozen=True)
class StaffJob:
    """직원 일 하나: origin(앞 일의 기계, None이면 대기 자리)에서 depart에 떠나 arrive에 기계 옆, 정리 손짓 뒤 put에 다시 놓고, 인사 뒤 end."""

    machine: str
    origin: str | None
    depart: float
    arrive: float
    put: float
    end: float


@dataclass(frozen=True)
class StaffBoard:
    jobs: dict[str, tuple[StaffJob, ...]] = field(default_factory=dict)  # 구역 → 일(차례대로)
    calls: dict[str, dict[str, int]] = field(default_factory=dict)  # 기계 → 손님 → 부른 뒤 그 기계에서 시작한 판 수


EMPTY_BOARD = StaffBoard()


def back_at(jobs: tuple[StaffJob, ...], zone: str) -> float | None:
    """마지막 일이 끝나고 대기 자리에 돌아오는 시각."""
    if not jobs:
        return None
    last = jobs[-1]
    return last.end + walk_seconds(side_spot(last.machine), post_of(zone))


def prune(board: StaffBoard, now: float) -> StaffBoard:
    """대기 자리로 돌아오기까지 끝난 구역의 일을 지운다(부른 판 수는 그대로)."""
    jobs = {z: js for z, js in board.jobs.items() if (back_at(js, z) or 0.0) > now}
    return board if jobs == board.jobs else replace(board, jobs=jobs)


def pending(board: StaffBoard, machine: str, now: float) -> StaffJob | None:
    """그 기계에 아직 다시 놓지 않은 일 — 그동안 아무도 그 기계를 시작하지 못하고 새 인형도 채우지 않는다."""
    zone = zone_of(machine)
    return next((j for j in board.jobs.get(zone or "", ()) if j.machine == machine and j.put > now), None)


def calls_left(board: StaffBoard, machine: str, guest: str) -> int:
    n = board.calls.get(machine, {}).get(guest)
    return 0 if n is None else max(0, STAFF["calls_every"] - n)


def count_play(board: StaffBoard, machine: str, guest: str) -> StaffBoard:
    """그 손님이 그 기계에서 한 판을 시작했다 — 부른 적이 있으면 판 수를 하나 더(다시 부를 수 있으면 더 세지 않음)."""
    seen = board.calls.get(machine, {})
    if guest not in seen or seen[guest] >= STAFF["calls_every"]:
        return board
    return replace(board, calls={**board.calls, machine: {**seen, guest: seen[guest] + 1}})


def plan_call(board: StaffBoard, machine: str, guest: str, now: float) -> tuple[StaffBoard, StaffJob] | str:
    """직원 부르기의 일정. 거절이면 이유: "wait"(부른 뒤 calls_every판이 안 됨) · "again"(그 기계에 끝나지 않은 일) · "busy"(기다리는 일이 queue_max개).
    앞 일이 끝나지 않았으면 그 기계 옆에서 곧장, 대기 자리로 돌아가는 중이면 돌아온 뒤 대기 자리에서, 아니면 지금 대기 자리에서 떠난다."""
    zone = zone_of(machine)
    assert zone is not None
    if calls_left(board, machine, guest) > 0:
        return "wait"
    jobs = board.jobs.get(zone, ())
    if any(j.machine == machine and j.end > now for j in jobs):
        return "again"
    if sum(j.depart > now for j in jobs) >= STAFF["queue_max"]:
        return "busy"
    active = [j for j in jobs if j.end > now]
    if active:
        origin: str | None = active[-1].machine
        depart, start = active[-1].end, side_spot(active[-1].machine)
    else:
        origin, depart, start = None, max(now, back_at(jobs, zone) or now), post_of(zone)  # 돌아오는 중이면 앞 일을 남겨 화면이 돌아오는 걸음을 이어 그린다
    arrive = depart + walk_seconds(start, side_spot(machine))
    put = arrive + STAFF["work"]
    job = StaffJob(machine, origin, depart, arrive, put, put + STAFF["bow"])
    seen = {g: n for g, n in board.calls.get(machine, {}).items() if g != guest}
    seen[guest] = 0
    while len(seen) > CALLS_KEEP:
        del seen[next(iter(seen))]
    return replace(board, jobs={**board.jobs, zone: (*jobs, job)}, calls={**board.calls, machine: seen}), job

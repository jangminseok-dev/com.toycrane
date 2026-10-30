"""매장 배치(shared/store_layout.json): 큰인형 기계 35대, 코인 교환소 2곳과 줄 자리, 걸어서 못 지나가는 상자."""

import math
from dataclasses import dataclass

from toycrane.domain.shared_data import LAYOUT
from toycrane.domain.value_objects.position import Position


@dataclass(frozen=True)
class Machine:
    id: str
    x: float
    z: float
    ry: float  # 0이면 +z(허브 쪽)를 봄
    set: str
    row: str  # "wall" | "island"


@dataclass(frozen=True)
class Counter:
    id: int
    x: float
    z: float
    ry: float
    window: Position
    queue: tuple[Position, ...]  # 0번이 창구 앞


@dataclass(frozen=True)
class MachineSpec:
    front: float  # 기계 앞자리까지 거리
    reach: float  # 앞자리에서 이만큼 안이면 시작할 수 있음
    play_half: tuple[float, float]  # 집게가 움직이는 반폭(x, z), 기계 안 좌표
    hole: tuple[float, float, float]  # 상품 구멍 (x, z, 반지름)
    claw_speed: float
    play_seconds: int


_spec = LAYOUT["machine"]
MACHINE_SPEC = MachineSpec(
    _spec["front"], _spec["reach"], tuple(_spec["play_half"]), tuple(_spec["hole"]), _spec["claw_speed"], _spec["play_seconds"]
)
MACHINE_IDS: tuple[str, ...] = tuple(m["id"] for m in LAYOUT["machines"])
MACHINES: dict[str, Machine] = {m["id"]: Machine(m["id"], m["x"], m["z"], m["ry"], m["set"], m["row"]) for m in LAYOUT["machines"]}
COUNTERS: tuple[Counter, ...] = tuple(
    Counter(c["id"], c["x"], c["z"], c["ry"], Position(*c["window"]), tuple(Position(*q) for q in c["queue"]))
    for c in LAYOUT["counters"]
)
OBSTACLES: tuple[tuple[float, float, float, float], ...] = tuple(tuple(o) for o in LAYOUT["obstacles"])


def front_spot(m: Machine) -> Position:
    """기계 앞에 서서 하는 자리."""
    return Position(m.x + math.sin(m.ry) * MACHINE_SPEC.front, m.z + math.cos(m.ry) * MACHINE_SPEC.front)

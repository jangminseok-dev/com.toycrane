"""매장 배치(shared/store_layout.json): 큰인형 기계 24대(캐릭터 하나에 기계 하나), 피규어 기계 14대, 작은 코인 교환소 4곳(줄 자리 없음), 걸어서 못 지나가는 상자."""

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
    kind: str  # 이 기계에 든 캐릭터
    row: str  # "d1" | "d2" | "d3"


@dataclass(frozen=True)
class Figure:
    """피규어 뽑기 기계(9단계): 상자 하나를 두 막대에 걸쳐 두고 뽑는다 — 무엇이 들었는지는 뽑힌 순간 정한다."""

    id: str
    x: float
    z: float
    ry: float
    row: str  # "f1" | "f2"


@dataclass(frozen=True)
class Counter:
    id: int
    x: float
    z: float
    ry: float
    window: Position  # 창구 앞 (여기서 1.5m 안이면 코인 받기·조르기)


@dataclass(frozen=True)
class MachineSpec:
    front: float  # 기계 앞자리까지 거리
    reach: float  # 앞자리에서 이만큼 안이면 시작할 수 있음
    play_half: tuple[float, float]  # 집게가 움직이는 반폭(x, z), 기계 안 좌표
    hole: tuple[float, float, float]  # 상품 구멍 (x, z, 반지름)
    claw_speed: float
    play_seconds: int
    hold_seconds: int  # 판이 끝난 뒤 그 사람이 이어서 할 수 있게 자리를 잡아 두는 시간


_spec = LAYOUT["machine"]
MACHINE_SPEC = MachineSpec(
    _spec["front"], _spec["reach"], tuple(_spec["play_half"]), tuple(_spec["hole"]), _spec["claw_speed"], _spec["play_seconds"], _spec["hold_seconds"]
)
MACHINE_IDS: tuple[str, ...] = tuple(m["id"] for m in LAYOUT["machines"])
MACHINES: dict[str, Machine] = {m["id"]: Machine(m["id"], m["x"], m["z"], m["ry"], m["kind"], m["row"]) for m in LAYOUT["machines"]}
COUNTERS: tuple[Counter, ...] = tuple(
    Counter(c["id"], c["x"], c["z"], c["ry"], Position(*c["window"]))
    for c in LAYOUT["counters"]
)
FIGURES: dict[str, Figure] = {f["id"]: Figure(f["id"], f["x"], f["z"], f["ry"], f["row"]) for f in LAYOUT["figures"]}
OBSTACLES: tuple[tuple[float, float, float, float], ...] = tuple(tuple(o) for o in LAYOUT["obstacles"])


def machine_spot(machine_id: str) -> Machine | Figure | None:
    """인형 기계든 피규어 기계든 번호로 찾는다(판 잠금·중계는 둘이 같다)."""
    return MACHINES.get(machine_id) or FIGURES.get(machine_id)


def front_spot(m: Machine | Figure) -> Position:
    """기계 앞에 서서 하는 자리."""
    return Position(m.x + math.sin(m.ry) * MACHINE_SPEC.front, m.z + math.cos(m.ry) * MACHINE_SPEC.front)

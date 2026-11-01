"""미는 뽑기 기계 속 미니 인형(설계 2026-11-02 ring-hook §4, 계획 12 Task 9) — 화면(client/src/physics/pusherWorld.ts,
sim/pusher.test.ts freshMachine)과 같은 수치(shared/pusher.json). 한 기계에 우리 24종이 섞인다. 처음엔 칸에 count개 +
턱 뒤쪽(미는 판 바로 앞)에 on_ledge개, 빈 자리는 칸 위에서 떨어뜨린다 — 턱 위는 손님이 올린 인형만.
자리는 인형 기계처럼 (x, z)만 찍고 안 앉은 채(y None) 둔다. 색·희귀·황금은 인형 기계와 같다(stock.new_doll)."""

import random

from toycrane.domain.catalog import DOLLS
from toycrane.domain.crane import DollSpot
from toycrane.domain.layout import MACHINE_SPEC
from toycrane.domain.shared_data import PUSHER
from toycrane.domain.stock import MachineStock, fill_up, new_doll

KINDS: tuple[str, ...] = tuple(DOLLS)
FULL = PUSHER["count"] + PUSHER["on_ledge"]  # 가득 찬 기계의 미니 인형 수(처음 배치와 같다)
_LEDGE = PUSHER["ledge"]
PILE_GAP = 0.06  # 칸 자리는 턱 오른쪽 끝(낮은 턱)에서 이만큼 떨어져 — 턱 위에 떨어지지 않게


def pile_spot(rng: random.Random) -> tuple[float, float]:
    """칸(턱 오른쪽 넓은 바닥) 아무 데나 — 화면이 번호 순서로 하나씩 떨어뜨리므로 서로 떨어질 필요는 없다."""
    w, d = MACHINE_SPEC.play_half
    return round(rng.uniform(_LEDGE["x1"] + PILE_GAP, w), 3), round(rng.uniform(-d, d), 3)


def ledge_spot(rng: random.Random) -> tuple[float, float]:
    """턱 뒤쪽 미는 판 바로 앞 — 판이 다 밀어도 끝까지 가지 않는 자리(처음부터 저절로 떨어지지 않게, 계획 12 Task 8 판정)."""
    return round(rng.uniform(_LEDGE["x0"] + 0.08, _LEDGE["x1"] - 0.06), 3), round(rng.uniform(_LEDGE["z0"] + 0.04, _LEDGE["z0"] + 0.12), 3)


def generate_mixed_stock(rng: random.Random) -> MachineStock:
    """처음 채우는 FULL개(칸 count개 다음 턱 위 on_ledge개, 번호 순서) — 희귀는 기계마다 1개까지, 황금 없음."""
    dolls: list[DollSpot] = []
    for uid in range(1, FULL + 1):
        kind, (x, z) = rng.choice(KINDS), (pile_spot if uid <= PUSHER["count"] else ledge_spot)(rng)
        dolls.append(new_doll(kind, rng, x, z, uid, rare_ok=not any(d.rare for d in dolls), gold_ok=False))
    return MachineStock(dolls, None, FULL + 1)


def refill_mixed(stock: MachineStock, now: float, held: bool, gold_in_store: int, rng: random.Random) -> tuple[MachineStock, list[DollSpot]]:
    """인형 기계 채우기(stock.refill)와 같은 시계·희귀·황금 규칙으로 FULL개까지 — 새 인형은 24종 중 아무거나, 칸 위에서."""
    return fill_up(stock, now, held, gold_in_store, rng, FULL, lambda _dolls: (rng.choice(KINDS), *pile_spot(rng)))

"""인형 기계 재배치 (설계 2026-11-24): 집게가 못 닿는 유리 쪽 띠의 인형을 직원이 닿는 빈자리로 옮긴다.

직원 부르기는 바로(move_unreachable), 판 끝 정리는 같은 자리에서 plays판 연달아 안 움직였을 때(tidy_unreachable, 미는 뽑기 tidy_stuck과 같은 틀).
옮긴 인형은 안 앉은 채(y None, 곧게)로 두어 화면들이 위에서 떨어뜨린다."""

import math
import random
from dataclasses import replace

from toycrane.domain.crane import REACH_HALF, UPRIGHT, DollSpot, spawn_spot, unreachable
from toycrane.domain.shared_data import CLAW
from toycrane.domain.stock import MachineStock

_REPOSITION = CLAW["reposition"]


def _move(stock: MachineStock, uids: set[int], rng: random.Random) -> MachineStock:
    keep = [d for d in stock.dolls if d.uid not in uids]
    dolls: list[DollSpot] = []
    for d in stock.dolls:
        if d.uid in uids:
            x, z = spawn_spot(keep, rng, REACH_HALF)  # 집게 가운데 범위 안 — 기준선 끝에 떨어지면 굴러서 다시 못 닿는 자리가 된다
            d = replace(d, x=x, y=None, z=z, q=UPRIGHT)
            keep.append(d)
        dolls.append(d)
    return replace(stock, dolls=dolls, stuck={u: n for u, n in stock.stuck.items() if u not in uids})


def move_unreachable(stock: MachineStock, rng: random.Random) -> tuple[MachineStock, list[int]]:
    """직원 부르기: 못 닿는 인형을 모두 옮기고 옮긴 번호를 돌려준다(없으면 stock 그대로)."""
    moved = [d.uid for d in stock.dolls if unreachable(d)]
    return (_move(stock, set(moved), rng), moved) if moved else (stock, [])


def tidy_unreachable(before: MachineStock, after: MachineStock, rng: random.Random) -> tuple[MachineStock, list[int]]:
    """판 끝: 판 전후 둘 다 못 닿는 자리이고 move(m)도 안 움직인 인형의 판 수를 세고(아니면 지움), plays판째면 옮긴다."""
    was = {d.uid: d for d in before.dolls}
    stuck: dict[int, int] = {}
    due: set[int] = set()
    for d in after.dolls:
        prev = was.get(d.uid)
        still = (
            prev is not None and unreachable(d) and unreachable(prev)
            and math.hypot(d.x - prev.x, d.y - prev.y, d.z - prev.z) < _REPOSITION["move"]  # type: ignore[operator]
        )
        n = after.stuck.get(d.uid, 0) + 1 if still else 0
        if n >= _REPOSITION["plays"]:
            due.add(d.uid)
        elif n:
            stuck[d.uid] = n
    tidied = replace(after, stuck=stuck)
    return (_move(tidied, due, rng), sorted(due)) if due else (tidied, [])

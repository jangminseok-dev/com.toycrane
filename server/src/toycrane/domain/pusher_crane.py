"""미는 뽑기 기계 속 미니 인형(설계 2026-11-02 ring-hook §4, 계획 12 Task 9) — 화면(client/src/physics/pusherWorld.ts,
sim/pusher.test.ts freshMachine)과 같은 수치(shared/pusher.json). 한 기계에 우리 24종이 섞인다. 처음엔 칸에 count개 +
턱 뒤쪽(미는 판 바로 앞)에 on_ledge개, 빈 자리는 칸 위에서 떨어뜨린다 — 턱 위는 손님이 올린 인형만.
자리는 인형 기계처럼 (x, z)만 찍고 안 앉은 채(y None) 둔다. 색·희귀·황금은 인형 기계와 같다(stock.new_doll)."""

import math
import random
from dataclasses import replace

from toycrane.domain.catalog import DOLLS
from toycrane.domain.crane import UPRIGHT, DollSpot
from toycrane.domain.layout import MACHINE_SPEC
from toycrane.domain.shared_data import PUSHER
from toycrane.domain.stock import MachineStock, count_miss, fill_up, new_doll

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


# 15판 보장(사용자 2026-11-02 '미는 뽑기 15판 안에 뽑게'): 같은 기계에서 한 손님이 이만큼 연달아 못 뽑으면 그 판 끝에 직원이 인형 하나를
# 꺼내 준다 — 어려움(잘 집는 사람 50%선 7판)은 그대로, 대충 하는 사람도 15판을 넘기지 않는다. 판 수 세기는 stock.count_miss
PITY_PLAYS: int = PUSHER["pity"]
# 직원이 정리(사용자 2026-11-02 사진 273 '턱 앞에 인형이 걸린다'): 턱 위에서 판 바로 앞(z0 + front)보다 앞에 있는 앉은 인형이 TIDY.plays판 연속
# TIDY.move(1cm)도 안 움직이면 직원이 턱 뒤쪽(판 바로 앞, ledge_spot)으로 옮겨 다시 밀리게 한다 — 안 앉은 채(y None)로 두어 화면이 떨어뜨린다
TIDY = PUSHER["tidy"]


def staff_pick(dolls: list[DollSpot]) -> int | None:
    """직원이 꺼내 줄 인형 번호: 턱 위(턱 오른쪽 끝보다 왼쪽) 앉은 인형 중 출구에 가장 가까운(앞, z가 큰) 것, 턱이 비었으면 칸에서 가장 앞."""
    ledge = [d for d in dolls if d.x < _LEDGE["x1"] and d.y is not None]
    pool = ledge or dolls
    return max(pool, key=lambda d: d.z).uid if pool else None


def after_pusher_play(stock: MachineStock, guest: str, won: bool) -> tuple[MachineStock, int | None]:
    """미는 뽑기 한 판 뒤: 그 손님의 연달아 못 뽑은 판 수를 세고(뽑으면 지움), PITY_PLAYS판째도 못 뽑았으면 직원이 꺼내 줄 인형 번호
    (그 인형은 아직 기계에 있다 — 부르는 쪽이 당첨처럼 뺀다)와 지운 판 수를 돌려준다."""
    after = count_miss(stock, guest, won)
    gift = staff_pick(stock.dolls) if after.misses.get(guest, 0) >= PITY_PLAYS else None
    if gift is not None:
        after = replace(after, misses={g: n for g, n in after.misses.items() if g != guest})
    return after, gift


def _on_ledge_front(d: DollSpot) -> bool:
    return d.y is not None and _LEDGE["x0"] <= d.x <= _LEDGE["x1"] and d.z > _LEDGE["z0"] + TIDY["front"]


def tidy_stuck(before: MachineStock, after: MachineStock, rng: random.Random) -> tuple[MachineStock, list[int]]:
    """한 판 뒤: 판 전후 자리를 견줘 턱 앞에서 안 움직인 인형의 판 수를 세고(움직였거나 없어졌으면 지움), TIDY.plays판째면 턱 뒤로 옮긴다.
    옮긴 인형 번호들도 돌려준다(결과에 tidied 수)."""
    was = {d.uid: d for d in before.dolls}
    stuck: dict[int, int] = {}
    moved: list[int] = []
    dolls: list[DollSpot] = []
    for d in after.dolls:
        prev = was.get(d.uid)
        still = prev is not None and _on_ledge_front(d) and _on_ledge_front(prev) and math.hypot(d.x - prev.x, d.y - prev.y, d.z - prev.z) < TIDY["move"]  # type: ignore[operator]
        n = after.stuck.get(d.uid, 0) + 1 if still else 0
        if n >= TIDY["plays"]:
            x, z = ledge_spot(rng)
            dolls.append(replace(d, x=x, y=None, z=z, q=UPRIGHT))
            moved.append(d.uid)
        else:
            dolls.append(d)
            if n:
                stuck[d.uid] = n
    return replace(after, dolls=dolls, stuck=stuck), moved


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

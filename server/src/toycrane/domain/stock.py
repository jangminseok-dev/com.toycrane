"""기계 속 인형 채우기 (설계 2026-10-31 인형 채우기 §4.1·§4.2·§4.4, 물리 뽑기 설계 §6).

새 인형은 서버가 정한다: 황금(매우 희귀) 0.5% — 새로 채울 때만, 희귀(특수효과 8가지) 3%, 나머지는 캐릭터 색 6가지 중 하나.
체형은 보통 50%·뚱뚱 25%·마른 25%, 표정은 5가지. 처음 채울 때는 9개(희귀는 기계마다 1개까지, 황금 없음).
자리는 (x, z)만 찍고 안 앉은 채(y None) 둔다 — 화면들이 같은 물리로 천장에서 떨어뜨려 앉힌다."""

import math
import random
from collections.abc import Callable
from dataclasses import dataclass

from toycrane.domain.catalog import EFFECTS, GOLD
from toycrane.domain.crane import DollSpot, spawn_spot

RARE_CHANCE = 0.03
GOLD_CHANCE = 0.005
REFILL_SECONDS = 30.0  # 빈 자리 하나가 채워지는 데 걸리는 시간 (아무도 그 기계를 잡고 있지 않은 시간만)
DOLLS_PER_MACHINE = 9
GOLD_PER_STORE = 3  # 매장에 동시에 있을 수 있는 황금 인형
COLORS, FACES = 6, 5


@dataclass(frozen=True)
class MachineStock:
    dolls: list[DollSpot]
    next_at: float | None  # 다음 빈 자리를 채울 시각 (가득 차 있으면 None)
    next_uid: int  # 다음에 들어올 인형의 번호


def new_doll(kind: str, rng: random.Random, x: float, z: float, uid: int, *, rare_ok: bool, gold_ok: bool) -> DollSpot:
    gold = gold_ok and rng.random() < GOLD_CHANCE
    effect = rng.choice(EFFECTS) if not gold and rare_ok and rng.random() < RARE_CHANCE else ""
    rare = GOLD if gold else effect
    roll = rng.random()
    body = "n" if roll < 0.5 else "c" if roll < 0.75 else "s"
    rng.uniform(0, 2 * math.pi)  # 옛 몸 돌림 자리 — 난수 순서를 지켜 같은 seed의 색·체형·표정이 그대로 나오게
    return DollSpot(kind, x, None, z, color=0 if rare else rng.randrange(COLORS), body=body, face=rng.randrange(FACES), rare=rare, uid=uid)


def generate_stock(kind: str, rng: random.Random) -> MachineStock:
    """처음 채우는 9개: 자리만 찍고 안 앉은 채 — 화면이 번호 순서로 떨어뜨린다."""
    dolls: list[DollSpot] = []
    for uid in range(1, DOLLS_PER_MACHINE + 1):
        x, z = spawn_spot(dolls, rng)
        dolls.append(new_doll(kind, rng, x, z, uid, rare_ok=not any(d.rare for d in dolls), gold_ok=False))
    return MachineStock(dolls, None, DOLLS_PER_MACHINE + 1)


def on_taken(stock: MachineStock, uids: list[int], now: float) -> MachineStock:
    """뽑혀 나간 인형(번호)을 빼고, 채우기 시계가 멈춰 있었으면 지금부터 30초."""
    gone = set(uids)
    if not gone:
        return stock
    return MachineStock([d for d in stock.dolls if d.uid not in gone], stock.next_at if stock.next_at is not None else now + REFILL_SECONDS, stock.next_uid)


def refill(stock: MachineStock, kind: str, now: float, held: bool, gold_in_store: int, rng: random.Random) -> tuple[MachineStock, list[DollSpot]]:
    """때가 지난 만큼 빈 자리를 하나씩(30초에 하나) 위에서 채운다. 누가 그 기계를 잡고 있으면(held) 채우지 않고 시계를 미룬다
    — 오래 붙잡았다 놓아도 한꺼번에 쏟아지지 않게. 희귀는 기계마다 1개, 황금도 기계마다 1개이고 매장 전체 3개까지."""
    return fill_up(stock, now, held, gold_in_store, rng, DOLLS_PER_MACHINE, lambda dolls: (kind, *spawn_spot(dolls, rng)))


def fill_up(
    stock: MachineStock, now: float, held: bool, gold_in_store: int, rng: random.Random, full: int,
    place: Callable[[list[DollSpot]], tuple[str, float, float]],
) -> tuple[MachineStock, list[DollSpot]]:
    """refill의 몸통 — 기계마다 가득 찬 개수(full)와 새 인형의 (캐릭터, x, z)를 고르는 법(place)만 다르다."""
    if stock.next_at is None or stock.next_at > now:
        return stock, []
    if held:
        return MachineStock(stock.dolls, now + REFILL_SECONDS, stock.next_uid), []
    dolls, next_at, uid, added = list(stock.dolls), stock.next_at, stock.next_uid, []
    while next_at is not None and next_at <= now and len(dolls) < full:
        kind, x, z = place(dolls)
        gold_ok = not any(d.rare == GOLD for d in dolls) and gold_in_store + sum(d.rare == GOLD for d in added) < GOLD_PER_STORE
        rare_ok = not any(d.rare and d.rare != GOLD for d in dolls)
        doll = new_doll(kind, rng, x, z, uid, rare_ok=rare_ok, gold_ok=gold_ok)
        dolls.append(doll)
        added.append(doll)
        uid += 1
        next_at = next_at + REFILL_SECONDS if len(dolls) < full else None
    return MachineStock(dolls, next_at, uid), added


def due(stocks: dict[str, MachineStock]) -> float | None:
    """매장에서 가장 먼저 채울 시각 (모두 가득이면 None)."""
    times = [s.next_at for s in stocks.values() if s.next_at is not None]
    return min(times) if times else None

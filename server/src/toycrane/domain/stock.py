"""기계 속 인형 채우기 (설계 2026-10-31 인형 채우기 §4.1·§4.2·§4.4, 물리 뽑기 설계 §6).

새 인형은 서버가 정한다: 황금(매우 희귀) 0.5% — 새로 채울 때만, 희귀(특수효과 8가지) 3%, 나머지는 캐릭터 색 6가지 중 하나.
체형은 보통 50%·뚱뚱 25%·마른 25%, 표정은 5가지. 처음 채울 때는 9개(희귀는 기계마다 1개까지, 황금 없음).
자리는 (x, z)만 찍고 안 앉은 채(y None) 둔다 — 화면들이 같은 물리로 천장에서 떨어뜨려 앉힌다."""

import math
import random
from collections.abc import Callable
from dataclasses import dataclass, field, replace

from toycrane.domain.catalog import EFFECTS, GOLD
from toycrane.domain.crane import DollSpot, spawn_spot
from toycrane.domain.shared_data import CLAW

RARE_CHANCE = 0.03
GOLD_CHANCE = 0.005
REFILL_SECONDS = 30.0  # 빈 자리 하나가 채워지는 데 걸리는 시간 (아무도 그 기계를 잡고 있지 않은 시간만)
DOLLS_PER_MACHINE = 9
# 한꺼번에 채우기(사용자 2026-11-02 '뽑는 속도가 빨라 — 어느 정도 다 뽑히면 우르르'): 이만큼 넘게 비면 빈 자리를 한 번에(claw.json refill.batch)
BATCH: int = CLAW["refill"]["batch"]
GOLD_PER_STORE = 3  # 매장에 동시에 있을 수 있는 황금 인형
COLORS, FACES = 6, 5


@dataclass(frozen=True)
class MachineStock:
    dolls: list[DollSpot]
    next_at: float | None  # 다음 빈 자리를 채울 시각 (가득 차 있으면 None)
    next_uid: int  # 다음에 들어올 인형의 번호
    misses: dict[str, int] = field(default_factory=dict)  # 손님마다 이 기계에서 연달아 못 뽑은 판 수(count_miss)
    stuck: dict[int, int] = field(default_factory=dict)  # 미는 뽑기 직원이 정리: 인형 번호마다 턱 위에서 연달아 안 움직인 판 수(pusher_crane.tidy_stuck)


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


# 연달아 못 뽑은 판(사용자 2026-11-02 '오기 생기게'): 인형 기계는 claw.json help.plays판째부터 뽑을 때까지 집게가 세지고(화면이 센 힘으로 한다),
# 미는 뽑기는 pusher.json pity판째에 직원이 하나 꺼내 준다(pusher_crane). 기계마다 최근 손님 MISS_KEEP명만 기억
MISS_KEEP = 40


def count_miss(stock: MachineStock, guest: str, won: bool) -> MachineStock:
    """한 판 뒤 그 손님의 연달아 못 뽑은 판 수: 못 뽑으면 하나 더(맨 뒤 = 가장 최근으로), 뽑으면 지운다."""
    misses = {g: n for g, n in stock.misses.items() if g != guest}
    if not won:
        misses[guest] = stock.misses.get(guest, 0) + 1
        while len(misses) > MISS_KEEP:
            del misses[next(iter(misses))]
    return replace(stock, misses=misses)


def on_taken(stock: MachineStock, uids: list[int], now: float) -> MachineStock:
    """뽑혀 나간 인형(번호)을 빼고, 채우기 시계가 멈춰 있었으면 지금부터 30초."""
    gone = set(uids)
    if not gone:
        return stock
    return replace(stock, dolls=[d for d in stock.dolls if d.uid not in gone], next_at=stock.next_at if stock.next_at is not None else now + REFILL_SECONDS)


def refill(stock: MachineStock, kind: str, now: float, held: bool, gold_in_store: int, rng: random.Random) -> tuple[MachineStock, list[DollSpot]]:
    """때가 지난 만큼 빈 자리를 하나씩(30초에 하나) 위에서 채운다 — BATCH개 넘게 비었으면 한 번에 다. 누가 그 기계를 잡고 있으면(held)
    채우지 않고 시계를 미룬다(판 중에 인형이 늘면 보고가 어긋난다 — 이어 하는 손님은 판 끝 top_up이 채운다). 희귀는 기계마다 1개,
    황금도 기계마다 1개이고 매장 전체 3개까지."""
    return fill_up(stock, now, held, gold_in_store, rng, DOLLS_PER_MACHINE, lambda dolls: (kind, *spawn_spot(dolls, rng)), BATCH)


def top_up(stock: MachineStock, kind: str, gold_in_store: int, rng: random.Random) -> tuple[MachineStock, list[DollSpot]]:
    """판 결과를 저장할 때: BATCH개 넘게 비었으면 그 자리에서 다 채운다(시계와 상관없이) — 판 결과와 같은 배치 메시지에 실린다."""
    return top_up_with(stock, gold_in_store, rng, DOLLS_PER_MACHINE, lambda dolls: (kind, *spawn_spot(dolls, rng)), BATCH)


def top_up_with(
    stock: MachineStock, gold_in_store: int, rng: random.Random, full: int, place: Callable[[list[DollSpot]], tuple[str, float, float]], batch: int,
) -> tuple[MachineStock, list[DollSpot]]:
    if full - len(stock.dolls) < batch:
        return stock, []
    return fill_up(replace(stock, next_at=-1.0), 0.0, False, gold_in_store, rng, full, place, batch)


def fill_up(
    stock: MachineStock, now: float, held: bool, gold_in_store: int, rng: random.Random, full: int,
    place: Callable[[list[DollSpot]], tuple[str, float, float]], batch: int,
) -> tuple[MachineStock, list[DollSpot]]:
    """refill의 몸통 — 기계마다 가득 찬 개수(full)와 새 인형의 (캐릭터, x, z)를 고르는 법(place), 한꺼번에 채우는 수(batch)만 다르다."""
    if stock.next_at is None or stock.next_at > now:
        return stock, []
    if held:
        return replace(stock, next_at=now + REFILL_SECONDS), []
    dolls, next_at, uid, added = list(stock.dolls), stock.next_at, stock.next_uid, []
    batch_now = full - len(dolls) >= batch  # 많이 비었으면 이번에 다
    while next_at is not None and (batch_now or next_at <= now) and len(dolls) < full:
        kind, x, z = place(dolls)
        gold_ok = not any(d.rare == GOLD for d in dolls) and gold_in_store + sum(d.rare == GOLD for d in added) < GOLD_PER_STORE
        rare_ok = not any(d.rare and d.rare != GOLD for d in dolls)
        doll = new_doll(kind, rng, x, z, uid, rare_ok=rare_ok, gold_ok=gold_ok)
        dolls.append(doll)
        added.append(doll)
        uid += 1
        next_at = next_at + REFILL_SECONDS if len(dolls) < full else None
    return replace(stock, dolls=dolls, next_at=next_at, next_uid=uid), added


def due(stocks: dict[str, MachineStock]) -> float | None:
    """매장에서 가장 먼저 채울 시각 (모두 가득이면 None)."""
    times = [s.next_at for s in stocks.values() if s.next_at is not None]
    return min(times) if times else None

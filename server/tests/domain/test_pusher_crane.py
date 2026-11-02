import random

from toycrane.domain.catalog import DOLLS
from toycrane.domain.layout import MACHINE_SPEC
from dataclasses import replace

from toycrane.domain.pusher_crane import FULL, PITY_PLAYS, after_pusher_play, generate_mixed_stock, refill_mixed
from toycrane.domain.shared_data import PUSHER
from toycrane.domain.stock import on_taken

LEDGE = PUSHER["ledge"]
W, D = MACHINE_SPEC.play_half


def in_pile(d) -> bool:
    return LEDGE["x1"] + 0.06 <= d.x <= W and -D <= d.z <= D


def on_ledge(d) -> bool:
    return LEDGE["x0"] + 0.08 <= d.x <= LEDGE["x1"] - 0.06 and LEDGE["z0"] + 0.04 <= d.z <= LEDGE["z0"] + 0.12


# 설계 ring-hook §4: 한 기계에 24종이 섞이고, 처음엔 칸에 count개 + 턱 뒤쪽에 on_ledge개 — 화면 sim freshMachine과 같은 규칙
def test_mixed_stock_uses_many_kinds():
    s = generate_mixed_stock(random.Random(1))
    assert len(s.dolls) == FULL == PUSHER["count"] + PUSHER["on_ledge"] and s.next_at is None and s.next_uid == FULL + 1
    assert [d.uid for d in s.dolls] == list(range(1, FULL + 1)) and not any(d.settled for d in s.dolls)
    assert len({d.kind for d in s.dolls}) >= 12 and all(d.kind in DOLLS for d in s.dolls)
    assert all(in_pile(d) for d in s.dolls[: PUSHER["count"]]) and all(on_ledge(d) for d in s.dolls[PUSHER["count"]:])
    assert not any(d.rare == "gold" for d in s.dolls) and sum(bool(d.rare) for d in s.dolls) <= 1


def test_mixed_stock_is_repeatable_for_a_seed():
    assert generate_mixed_stock(random.Random(5)) == generate_mixed_stock(random.Random(5))


# Review Focus 4: 채우기가 기계당 개수, 희귀 1·황금 1, 매장 황금 3을 넘지 않는다 — 새 인형은 칸 위에서 떨어뜨린다
def test_mixed_refill_keeps_the_caps():
    rng, golds = random.Random(9), 0
    s, t = generate_mixed_stock(rng), 0.0
    for _ in range(600):
        s = on_taken(s, [s.dolls[-1].uid, s.dolls[0].uid], now=t)
        s, added = refill_mixed(s, t + 3600, False, golds, rng)
        t += 3600
        golds = sum(d.rare == "gold" for d in s.dolls)
        assert len(s.dolls) == FULL and s.next_at is None
        assert all(in_pile(d) and not d.settled for d in added)
        assert sum(d.rare not in ("", "gold") for d in s.dolls) <= 1 and golds <= 1
    store = 0
    for seed in range(3000):
        m = on_taken(generate_mixed_stock(random.Random(seed)), [1], now=0.0)
        _, added = refill_mixed(m, 30.0, False, store, random.Random(seed))
        store += sum(d.rare == "gold" for d in added)
    assert store == 3


def test_a_held_pusher_is_not_refilled():
    s = on_taken(generate_mixed_stock(random.Random(1)), [1], now=0.0)
    held, added = refill_mixed(s, 60.0, True, 0, random.Random(2))
    assert added == [] and held.next_at == 90.0 and len(held.dolls) == FULL - 1


# 15판 보장(사용자 2026-11-02 '미는 뽑기 15판 안에 뽑게'): 같은 기계에서 한 사람이 연달아 못 뽑은 판을 세고, 15판째도 못 뽑으면
# 직원이 턱 위에서 출구에 가장 가까운(앞, z가 큰) 인형을 꺼내 준다. 뽑으면 0부터, 사람마다 따로
def test_the_fifteenth_miss_in_a_row_gets_the_front_ledge_doll():
    stock = generate_mixed_stock(random.Random(5))
    back = replace(stock.dolls[0], x=-0.35, y=0.99, z=LEDGE["z0"] + 0.1, uid=998)  # 턱 위 뒤쪽
    front = replace(stock.dolls[1], x=-0.3, y=0.99, z=LEDGE["z1"] - 0.02, uid=999)  # 턱 위 앞 끝 — 꺼내 줄 인형
    stock = replace(stock, dolls=[*stock.dolls, back, front])
    for n in range(1, PITY_PLAYS):
        stock, gift = after_pusher_play(stock, "g-1", won=False)
        assert gift is None and stock.misses["g-1"] == n
    stock, other = after_pusher_play(stock, "g-2", won=False)
    assert other is None and stock.misses["g-2"] == 1
    stock, gift = after_pusher_play(stock, "g-1", won=False)
    assert gift == 999 and "g-1" not in stock.misses and stock.misses["g-2"] == 1


def test_a_win_starts_the_count_again():
    stock = generate_mixed_stock(random.Random(5))
    for _ in range(PITY_PLAYS - 1):
        stock, _gift = after_pusher_play(stock, "g-1", won=False)
    stock, gift = after_pusher_play(stock, "g-1", won=True)
    assert gift is None and "g-1" not in stock.misses
    stock, gift = after_pusher_play(stock, "g-1", won=False)
    assert gift is None and stock.misses["g-1"] == 1


# 턱이 비었으면 칸에서 가장 앞 인형을 꺼내 준다(직원 손이 닿는 쪽)
def test_with_an_empty_ledge_the_front_pile_doll_is_given():
    stock = generate_mixed_stock(random.Random(5))
    pile = [d for d in stock.dolls if d.x >= LEDGE["x1"]]
    stock = replace(stock, dolls=pile, misses={"g-1": PITY_PLAYS - 1})
    stock, gift = after_pusher_play(stock, "g-1", won=False)
    assert gift == max(pile, key=lambda d: d.z).uid

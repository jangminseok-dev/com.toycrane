import random

from toycrane.domain.catalog import DOLLS
from toycrane.domain.layout import MACHINE_SPEC
from toycrane.domain.pusher_crane import FULL, generate_mixed_stock, refill_mixed
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

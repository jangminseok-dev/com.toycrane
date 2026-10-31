import math
import random

import pytest

from toycrane.domain.layout import MACHINE_SPEC
from toycrane.domain.stock import MachineStock, due, generate_stock, new_doll, on_taken, refill


# 새 인형 (설계 2026-10-31 인형 채우기 §4.2·§4.4): 황금 0.5%·희귀 3%(효과 8가지), 체형 50/25/25, 표정 5, 색 6
def test_new_dolls_follow_the_odds():
    rng = random.Random(1)
    dolls = [new_doll("bear", rng, 0, 0, i, rare_ok=True, gold_ok=True) for i in range(20000)]

    def share(f):
        return sum(map(f, dolls)) / len(dolls)

    assert abs(share(lambda d: d.rare == "gold") - 0.005) < 0.002
    assert abs(share(lambda d: d.rare not in ("", "gold")) - 0.03) < 0.006
    assert len({d.rare for d in dolls} - {"", "gold"}) == 8
    assert abs(share(lambda d: d.body == "c") - 0.25) < 0.02 and abs(share(lambda d: d.body == "n") - 0.5) < 0.02
    assert {d.face for d in dolls} == set(range(5)) and {d.color for d in dolls} == set(range(6))


def test_no_rare_or_gold_when_not_allowed():
    rng = random.Random(2)
    assert all(new_doll("bear", rng, 0, 0, i, rare_ok=False, gold_ok=False).rare == "" for i in range(3000))


def test_first_fill_has_nine_dolls_no_gold_and_at_most_one_rare():
    for seed in range(200):
        s = generate_stock("bear", random.Random(seed))
        assert len(s.dolls) == 9 and s.next_at is None and not any(d.rare == "gold" for d in s.dolls)
        assert sum(d.rare != "" for d in s.dolls) <= 1 and len({d.uid for d in s.dolls}) == 9 and s.next_uid > max(d.uid for d in s.dolls)


def test_first_fill_stays_in_play_area_and_out_of_hole():
    s = generate_stock("bunny", random.Random(1))
    hx, hz, _ = MACHINE_SPEC.hole
    for d in s.dolls:
        assert abs(d.x) <= 0.44 and abs(d.z) <= 0.38
        assert abs(d.x - hx) > 0.22 or abs(d.z - hz) > 0.22
        assert d.kind == "bunny"


# 물리 뽑기 설계 §6: 처음 9개도 안 앉은 채(y None) — 화면들이 같은 물리로 하나씩 떨어뜨린다
def test_new_stock_is_nine_unsettled_dolls():
    s = generate_stock("bear", random.Random(3))
    assert [d.uid for d in s.dolls] == list(range(1, 10)) and all(d.y is None for d in s.dolls)


def test_refill_adds_unsettled_dolls():
    s = on_taken(generate_stock("bear", random.Random(1)), [1], now=100.0)
    full, added = refill(s, "bear", 130.0, False, 0, random.Random(2))
    assert len(added) == 1 and added[0].y is None and full.dolls[-1] is added[0]


def test_on_taken_removes_by_uid():
    s = generate_stock("bear", random.Random(1))
    after = on_taken(s, [2, 5], now=100.0)
    assert [d.uid for d in after.dolls] == [1, 3, 4, 6, 7, 8, 9] and after.next_at == 130.0


def test_first_fill_is_repeatable_for_a_seed():
    assert generate_stock("penguin", random.Random(7)) == generate_stock("penguin", random.Random(7))


# 떨어뜨릴 자리끼리 너무 가깝지 않게 (겹쳐 떨어지면 튀어 나간다)
@pytest.mark.parametrize("seed", range(20))
def test_drop_spots_keep_their_distance(seed):
    dolls = generate_stock("fox", random.Random(seed)).dolls
    for i, a in enumerate(dolls):
        for b in dolls[i + 1:]:
            assert math.hypot(a.x - b.x, a.z - b.z) >= 0.16


# ---- 채우기 (설계 2026-10-31 인형 채우기 §4.1): 빈 자리 하나가 30초마다, 잠긴 동안은 세지 않음 ----
def test_a_won_slot_stays_empty_then_refills_after_30s():
    s = on_taken(generate_stock("bear", random.Random(1)), [1], now=100.0)
    assert len(s.dolls) == 8 and s.next_at == 130.0
    same, added = refill(s, "bear", 129.0, False, 0, random.Random(2))
    assert added == [] and len(same.dolls) == 8
    full, added = refill(s, "bear", 130.0, False, 0, random.Random(2))
    assert len(added) == 1 and len(full.dolls) == 9 and full.next_at is None
    assert added[0].uid == s.next_uid and full.next_uid == s.next_uid + 1


def test_a_second_win_does_not_restart_the_clock():
    s = on_taken(generate_stock("bear", random.Random(1)), [1], now=100.0)
    s = on_taken(s, [2], now=120.0)
    assert s.next_at == 130.0


# Review Focus 1: 아무도 없던 매장에 오랜만에 들어와도 밀린 만큼만, 9개를 넘지 않게
def test_refill_catches_up_after_a_long_quiet_but_never_overfills():
    s = generate_stock("bear", random.Random(1))
    for uid in range(1, 6):
        s = on_taken(s, [uid], now=100.0)
    full, added = refill(s, "bear", 100.0 + 3600, False, 0, random.Random(3))
    assert len(full.dolls) == 9 and len(added) == 5 and full.next_at is None


# Review Focus 2: 오래 붙잡았다 놓아도 한꺼번에 쏟아지지 않고, 놓은 뒤 30초
def test_a_held_machine_waits_a_full_slot_after_release():
    s = on_taken(generate_stock("bear", random.Random(1)), [1], now=0.0)
    held, added = refill(s, "bear", 180.0, True, 0, random.Random(4))
    assert added == [] and held.next_at == 210.0
    _, added = refill(held, "bear", 200.0, False, 0, random.Random(4))
    assert added == []
    _, added = refill(held, "bear", 210.0, False, 0, random.Random(4))
    assert len(added) == 1


# Review Focus 4: 매장 전체 황금은 동시에 3개까지
def test_gold_never_exceeds_three_in_the_store():
    golds = 0
    for seed in range(3000):
        s = on_taken(generate_stock("bear", random.Random(seed)), [1], now=0.0)
        _, added = refill(s, "bear", 30.0, False, golds, random.Random(seed))
        golds += sum(d.rare == "gold" for d in added)
    assert golds == 3


def test_at_most_one_rare_and_one_gold_per_machine():
    rng = random.Random(9)
    s, t = generate_stock("bear", rng), 0.0
    for _ in range(600):
        s = on_taken(s, [s.dolls[-1].uid], now=t)
        s, _ = refill(s, "bear", t + 30, False, 0, rng)
        t += 30
        assert sum(d.rare not in ("", "gold") for d in s.dolls) <= 1 and sum(d.rare == "gold" for d in s.dolls) <= 1


def test_due_is_the_earliest_refill_time():
    full = generate_stock("bear", random.Random(1))
    assert due({"A-1": full}) is None
    assert due({"A-1": full, "A-2": MachineStock(full.dolls[1:], 50.0, 10), "A-3": MachineStock(full.dolls[2:], 40.0, 10)}) == 40.0

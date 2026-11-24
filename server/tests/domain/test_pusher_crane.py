import math
import random

from toycrane.domain.catalog import DOLLS
from toycrane.domain.layout import MACHINE_SPEC
from dataclasses import replace

from toycrane.domain.pusher_crane import BATCH_MIXED, FULL, PITY_PLAYS, TIDY, after_pusher_play, generate_mixed_stock, refill_mixed, tidy_stuck, top_up_mixed
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


# 직원이 정리(사용자 2026-11-02 사진 273 '턱 앞에 인형이 걸린다'): 턱 위(판 바로 앞은 빼고)에서 판이 미는데도 TIDY.plays판 연속 TIDY.move(1cm)도
# 안 움직인 인형은 직원이 턱 뒤쪽(판 바로 앞)으로 옮겨 다시 밀리게 한다 — 옮긴 인형은 안 앉은 채(y None)로 화면이 떨어뜨린다
def _ledge_doll(stock, uid, x, z, y=0.99):
    return replace(stock.dolls[0], x=x, y=y, z=z, uid=uid)


def test_a_ledge_doll_that_never_moves_is_tidied_to_the_back_after_three_plays():
    stock = generate_mixed_stock(random.Random(5))
    front = _ledge_doll(stock, 901, -0.3, LEDGE["z1"] - 0.03)  # 턱 앞 끝에 걸린 인형
    stock = replace(stock, dolls=[*stock.dolls, front])
    rng = random.Random(1)
    for n in (1, 2):
        stock, moved = tidy_stuck(stock, stock, rng)
        assert moved == [] and stock.stuck[901] == n
    stock, moved = tidy_stuck(stock, stock, rng)
    assert moved == [901] and 901 not in stock.stuck
    d = next(d for d in stock.dolls if d.uid == 901)
    assert d.y is None and LEDGE["z0"] + 0.04 <= d.z <= LEDGE["z0"] + 0.12 and LEDGE["x0"] < d.x < LEDGE["x1"]


def test_moving_or_leaving_resets_the_count_and_the_plate_side_is_never_counted():
    stock = generate_mixed_stock(random.Random(5))
    front = _ledge_doll(stock, 901, -0.3, LEDGE["z1"] - 0.03)
    back = _ledge_doll(stock, 902, -0.3, LEDGE["z0"] + 0.05)  # 판 바로 앞 — 판이 들어가 있으면 원래 안 움직인다
    pile = _ledge_doll(stock, 903, 0.2, 0.0)  # 칸(턱 밖)
    stock = replace(stock, dolls=[*stock.dolls, front, back, pile], stuck={901: 2})
    moved_front = replace(front, z=front.z - 0.02)  # 2cm 움직였다
    after = replace(stock, dolls=[*stock.dolls[:-3], moved_front, back, pile])
    after, moved = tidy_stuck(stock, after, random.Random(1))
    assert moved == [] and after.stuck == {}
    gone = replace(after, dolls=[d for d in after.dolls if d.uid != 901], stuck={901: 2})
    gone, moved = tidy_stuck(after, gone, random.Random(1))
    assert moved == [] and gone.stuck == {}
    assert TIDY["plays"] == 3 and TIDY["move"] == 0.01


# 미는 뽑기도 한꺼번에 채우기: BATCH_MIXED(6)개 넘게 비면 칸 위에 한 번에
def test_a_pusher_refills_a_batch_at_once():
    stock = generate_mixed_stock(random.Random(5))
    taken = on_taken(stock, [d.uid for d in stock.dolls[:BATCH_MIXED]], now=0.0)
    after, added = refill_mixed(taken, 30.0, False, 0, random.Random(2))
    assert len(added) == BATCH_MIXED and after.next_at is None and all(d.x > LEDGE["x1"] for d in added)
    five = on_taken(stock, [d.uid for d in stock.dolls[: BATCH_MIXED - 1]], now=0.0)
    assert top_up_mixed(five, 0, random.Random(2)) == (five, [])
    after, added = top_up_mixed(taken, 0, random.Random(2))
    assert len(added) == BATCH_MIXED


# 상주 직원의 전부 다시 놓기(설계 2026-11-24 store-staff): 칸 인형은 칸 새 자리, 턱 위 인형은 턱 위에서 깊이(z)는 그대로 x만 고르게 — 쌓아 온 진행을 뺏지 않는다
def _with_ledge(seed: int):
    s = generate_mixed_stock(random.Random(seed))
    rng = random.Random(seed + 100)
    dolls = [replace(d, x=rng.uniform(LEDGE["x0"] + 0.05, LEDGE["x1"] - 0.03), y=0.99, z=rng.uniform(LEDGE["z0"], LEDGE["z1"])) if i < 6 else replace(d, y=0.87)
             for i, d in enumerate(s.dolls)]
    return replace(s, dolls=dolls, stuck={dolls[0].uid: 2})


def test_redrop_mixed_keeps_ledge_dolls_on_the_ledge_at_their_depth():
    from toycrane.domain.pusher_crane import REDROP_Z, redrop_mixed

    before = _with_ledge(1)
    after = redrop_mixed(before, random.Random(2))
    was = {d.uid: d for d in before.dolls}
    ledge = [d for d in after.dolls if was[d.uid].x < LEDGE["x1"]]
    assert len(ledge) == 6 and all(d.y is None and d.q == (0.0, 0.0, 0.0, 1.0) for d in after.dolls) and after.stuck == {}
    for d in ledge:
        assert LEDGE["x0"] + 0.08 <= d.x <= LEDGE["x1"] - 0.06
        assert math.isclose(d.z, min(max(was[d.uid].z, REDROP_Z[0]), REDROP_Z[1]), abs_tol=5e-4)  # 자리는 mm 셋째 자리로 반올림
    assert all(in_pile(d) for d in after.dolls if was[d.uid].x >= LEDGE["x1"])
    gaps = [math.hypot(a.x - b.x, a.z - b.z) for i, a in enumerate(ledge) for b in ledge[i + 1:]]
    assert min(gaps) > 0.01  # 같은 자리에 겹쳐 떨어지지 않게(자리가 모자라면 간격을 줄여 물러섬)


def test_redrop_mixed_does_not_move_ledge_dolls_forward_on_average():
    from toycrane.domain.pusher_crane import REDROP_Z, redrop_mixed

    moved, n = 0.0, 0
    for seed in range(50):
        before = _with_ledge(seed)
        was = {d.uid: d for d in before.dolls}
        for d in redrop_mixed(before, random.Random(seed)).dolls:
            if was[d.uid].x < LEDGE["x1"]:
                moved += d.z - min(max(was[d.uid].z, REDROP_Z[0]), REDROP_Z[1])
                n += 1
    assert abs(moved / n) < 5e-4  # 평균으로 앞으로도 뒤로도 가지 않는다(반올림만큼)

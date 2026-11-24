import random
from dataclasses import replace

from toycrane.domain.crane import REACH_HALF, DollSpot, unreachable
from toycrane.domain.layout import MACHINE_SPEC
from toycrane.domain.reposition import move_unreachable, tidy_unreachable
from toycrane.domain.shared_data import CLAW
from toycrane.domain.stock import MachineStock

OUT = CLAW["reposition"]["out"]
RW, RD = REACH_HALF


def doll(uid: int, x: float, z: float, y: float | None = 0.1) -> DollSpot:
    return DollSpot("bear", x, y, z, uid=uid)


def inside(d: DollSpot) -> bool:
    hx, hz, _ = MACHINE_SPEC.hole
    half = CLAW["hole"]["size"] / 2
    return abs(d.x) <= RW + OUT and abs(d.z) <= RD + OUT and (abs(d.x - hx) > half or abs(d.z - hz) > half)  # 못 닿는 자리 안쪽(crane.DROP_HALF)


def test_unreachable_is_only_settled_dolls_past_the_band():
    assert unreachable(doll(1, RW + OUT + 0.01, 0.0))
    assert unreachable(doll(1, -(RW + OUT + 0.01), 0.0))
    assert unreachable(doll(1, 0.0, RD + OUT + 0.01))
    assert unreachable(doll(1, 0.0, -(RD + OUT + 0.01)))
    assert not unreachable(doll(1, RW + OUT - 0.01, 0.0))
    assert not unreachable(doll(1, 0.0, RD + OUT - 0.01))
    assert not unreachable(doll(1, RW + OUT + 0.01, 0.0, y=None))  # 아직 안 앉은(떨어지는 중) 인형은 건드리지 않는다


def test_move_unreachable_moves_every_stuck_doll_inside():
    far = [doll(1, RW + OUT + 0.03, 0.0), doll(2, 0.1, -(RD + OUT + 0.02))]
    near = [doll(3, 0.0, 0.0), doll(4, 0.2, -0.1), doll(5, 0.1, 0.1)]
    stock = MachineStock(far + near, None, 6, stuck={1: 2, 3: 1})
    after, moved = move_unreachable(stock, random.Random(1))
    assert sorted(moved) == [1, 2]
    by = {d.uid: d for d in after.dolls}
    for uid in (1, 2):
        assert by[uid].y is None and by[uid].q == (0.0, 0.0, 0.0, 1.0) and inside(by[uid])
    assert [by[u] for u in (3, 4, 5)] == near
    assert after.stuck == {3: 1}


def test_move_unreachable_with_nothing_to_move_keeps_the_stock():
    stock = MachineStock([doll(1, 0.0, 0.0), doll(2, RW + OUT + 0.03, 0.0, y=None)], None, 3)
    after, moved = move_unreachable(stock, random.Random(1))
    assert after == stock and moved == []


def test_tidy_unreachable_moves_on_the_third_still_play():
    stuck_doll = doll(1, RW + OUT + 0.03, 0.05)
    s = MachineStock([stuck_doll, doll(2, 0.0, 0.0)], None, 3)
    s, moved = tidy_unreachable(s, s, random.Random(1))
    assert moved == [] and s.stuck == {1: 1}
    s, moved = tidy_unreachable(s, s, random.Random(1))
    assert moved == [] and s.stuck == {1: 2}
    s, moved = tidy_unreachable(s, s, random.Random(1))
    d = next(d for d in s.dolls if d.uid == 1)
    assert moved == [1] and 1 not in s.stuck and d.y is None and inside(d)


def test_tidy_unreachable_resets_when_the_doll_moves():
    a = MachineStock([doll(1, RW + OUT + 0.03, 0.05)], None, 2, stuck={1: 2})
    b = replace(a, dolls=[doll(1, RW + OUT + 0.03, 0.07)])  # 2cm 움직였다
    after, moved = tidy_unreachable(a, b, random.Random(1))
    assert moved == [] and after.stuck == {}

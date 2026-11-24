import random
from dataclasses import replace

from fakes import FakeConnections, FakeContents, FakeLocks
from toycrane.adapter.inbound.ws.schemas.server_messages import machine, staffed
from toycrane.app.dtos.staff_dto import StaffCommand
from toycrane.app.use_cases.staff_interactor import StaffInteractor
from toycrane.domain.crane import REACH_HALF
from toycrane.domain.layout import MACHINE_IDS, MACHINES, PUSHERS
from toycrane.domain.pusher_crane import generate_mixed_stock
from toycrane.domain.shared_data import CLAW
from toycrane.domain.stock import generate_stock

FAR = REACH_HALF[0] + CLAW["reposition"]["out"] + 0.03


def setup(glass: int = 2):
    """A-1에 앉은 인형을 놓고, 앞 glass개는 유리 쪽 못 닿는 자리에."""
    stored = {m: generate_stock(MACHINES[m].kind, random.Random(9)) for m in MACHINE_IDS}
    stored.update({p: generate_mixed_stock(random.Random(9)) for p in PUSHERS})
    s = stored["A-1"]
    dolls = [replace(d, x=FAR if i < glass else 0.1 * (i % 3), y=0.87, z=-0.3 + 0.07 * i) for i, d in enumerate(s.dolls)]
    stored["A-1"] = replace(s, dolls=dolls)
    locks, conns, contents = FakeLocks(), FakeConnections(), FakeContents(stored)
    return locks, conns, contents, StaffInteractor(locks, contents, conns)


# 직원 부르기(설계 2026-11-24 나): 판 사이 자리를 잡은 사람이 부르면 못 닿는 인형을 바로 옮기고, 모두에게 새 배치, 부른 사람에게 옮긴 수. 자리 시간은 새로
async def test_staff_moves_unreachable_dolls_for_the_seated_player():
    locks, conns, contents, it = setup(glass=2)
    locks.hold("c-1", "A-1", 10.0)
    await it.call(StaffCommand("c-1", "A-1", now=15.0))
    after = contents.stored["A-1"]
    assert contents.saves == 1 and not any(abs(d.x) > REACH_HALF[0] for d in after.dolls)
    assert conns.broadcasts == [(None, machine("A-1", after.dolls))]
    assert conns.direct == [("c-1", staffed("A-1", 2))]
    assert locks.lock_of("c-1") == ("A-1", 15.0) and locks.is_between("c-1")


async def test_staff_with_nothing_to_move_says_zero():
    locks, conns, contents, it = setup(glass=0)
    locks.hold("c-1", "A-1", 10.0)
    await it.call(StaffCommand("c-1", "A-1", now=15.0))
    assert contents.saves == 0 and conns.broadcasts == []
    assert conns.direct == [("c-1", staffed("A-1", 0))]


async def test_staff_from_someone_not_seated_is_ignored():
    for seat in (None, ("A-2", True), ("A-1", False)):  # 잠금 없음, 다른 기계 자리, 한 판 도중
        locks, conns, contents, it = setup(glass=2)
        if seat:
            (locks.hold if seat[1] else locks.lock)("c-1", seat[0], 10.0)
        await it.call(StaffCommand("c-1", "A-1", now=15.0))
        assert contents.saves == 0 and conns.broadcasts == [] and conns.direct == []


async def test_staff_on_a_pusher_is_ignored():
    locks, conns, contents, it = setup()
    pusher = next(iter(PUSHERS))
    locks.hold("c-1", pusher, 10.0)
    await it.call(StaffCommand("c-1", pusher, now=15.0))
    assert contents.saves == 0 and conns.broadcasts == [] and conns.direct == []

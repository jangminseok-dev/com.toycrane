"""고리·미는 뽑기 판(설계 2026-11-02 §3·§4·§8): 잠근 사람이 멈춘 자리(act)만 보내면 서버가 결과를 정해 가방·result·기계 상태를 알린다.
잠금 없이·같은 판 두 번·이상한 좌표는 거절하고 기계 상태는 그대로."""

import math
import random

from fakes import FakeBag, FakeConnections, FakeLocks, FakeRegistry, FakeRingBoards, player
from toycrane.adapter.inbound.ws.schemas.server_messages import done_no, result, ring
from toycrane.app.dtos.act_dto import ActCommand
from toycrane.app.use_cases.act_interactor import ActInteractor
from toycrane.domain.ring import new_board, peg_xy


class Always(random.Random):
    """출구까지 늘 오는(또는 늘 빠지는) 난수 — random()만 고정."""

    def __init__(self, value: float) -> None:
        super().__init__(1)
        self.value = value

    def random(self) -> float:
        return self.value


def setup(rng: random.Random | None = None):
    reg, conns, bag = FakeRegistry(), FakeConnections(), FakeBag()
    locks = FakeLocks({"c-1": "p1", "c-2": "p2"})
    reg.put("c-1", player("p1", guest="g-1"))
    reg.put("c-2", player("p2", guest="g-2"))
    rings = FakeRingBoards({"R-1": new_board(random.Random(3))})
    locks.lock("c-1", "R-1", 10.0)
    return locks, conns, bag, rings, ActInteractor(reg, locks, rings, bag, conns, rng=rng or random.Random(5))


async def test_ring_catch_puts_the_card_in_the_bag_and_restocks():
    locks, conns, bag, rings, it = setup(Always(0.0))
    before = rings.stored["R-1"]
    x, y = peg_xy(2)
    await it.act(ActCommand("c-1", "R-1", x, y, now=20.0))
    card = before[2]
    assert bag.added == [("g-1", card.kind, card.color, card.rare, "ring")]
    assert conns.direct == [("c-1", {"t": "bag", "n": 1})]
    after = rings.stored["R-1"]
    assert after[:2] == before[:2] and after[3:] == before[3:] and after[2] is not before[2]  # 그 걸이만 새 카드
    assert conns.broadcasts == [(None, result("R-1", "p1", [(card.kind, card.color, card.rare, 0)])), (None, ring("R-1", after, x, y, 2, True))]
    assert locks.is_between("c-1")


async def test_ring_slip_keeps_the_card():
    locks, conns, bag, rings, it = setup(Always(0.99))
    before = rings.stored["R-1"]
    x, y = peg_xy(2)
    await it.act(ActCommand("c-1", "R-1", x, y, now=20.0))
    assert bag.added == [] and rings.stored["R-1"] == before
    assert conns.broadcasts == [(None, result("R-1", "p1", [])), (None, ring("R-1", before, x, y, 2, False))]


async def test_act_without_a_lock_or_twice_is_refused():
    locks, conns, bag, rings, it = setup(Always(0.0))
    x, y = peg_xy(2)
    await it.act(ActCommand("c-2", "R-1", x, y, now=20.0))  # 잠금 없음
    assert conns.broadcasts == [] and bag.added == []
    await it.act(ActCommand("c-1", "R-1", x, y, now=20.0))
    n = len(conns.broadcasts)
    await it.act(ActCommand("c-1", "R-1", x, y, now=21.0))  # 같은 판 두 번
    assert len(conns.broadcasts) == n and len(bag.added) == 1


async def test_bad_act_is_refused_and_keeps_the_board():
    locks, conns, bag, rings, it = setup(Always(0.0))
    before = rings.stored["R-1"]
    await it.act(ActCommand("c-1", "R-1", math.nan, 1.4, now=20.0))
    assert conns.direct == [("c-1", done_no("R-1", "bad"))]
    assert conns.broadcasts == [] and bag.added == [] and rings.stored["R-1"] == before

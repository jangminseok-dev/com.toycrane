import random

from fakes import FakeBag, FakeConnections, FakeContents, FakeLocks, FakeRegistry, player
from toycrane.adapter.inbound.ws.schemas.server_messages import bag as bag_msg
from toycrane.adapter.inbound.ws.schemas.server_messages import free
from toycrane.app.dtos.drop_dto import DropCommand
from toycrane.app.use_cases.drop_interactor import DropInteractor
from toycrane.domain.crane import DollSpot, generate_contents
from toycrane.domain.layout import MACHINE_IDS, MACHINES


class Rolls(random.Random):
    """판정 굴림(random())만 정해 둔 난수."""

    def __init__(self, value: float) -> None:
        super().__init__(1)
        self.value = value

    def random(self) -> float:
        return self.value


def setup(roll: float):
    reg, locks, conns, bag = FakeRegistry(), FakeLocks({"c-1": "p1"}), FakeConnections(), FakeBag({"g-1": 2})
    reg.put("c-1", player("p1", guest="g-1"))
    stored = {m: generate_contents(MACHINES[m].set, random.Random(9)) for m in MACHINE_IDS}
    stored["A-1"] = [DollSpot("bunny", 0.0, 0.0, 0.0)] + stored["A-1"][1:]
    contents = FakeContents(stored)
    locks.lock("c-1", "A-1", 10.0)
    return locks, conns, bag, contents, DropInteractor(reg, locks, contents, bag, conns, Rolls(roll))


async def test_winning_drop_moves_the_doll_into_the_bag():
    locks, conns, bag, contents, it = setup(roll=0.1)
    before = list(contents.stored["A-1"])
    await it.drop(DropCommand("c-1", 0.0, 0.0, now=15.0))
    result = next(m for _, m in conns.broadcasts if m["t"] == "result")
    assert {k: result[k] for k in ("m", "id", "o", "part", "k")} == {"m": "A-1", "id": "p1", "o": "win", "part": "head", "k": "bunny"}
    machine = next(m for _, m in conns.broadcasts if m["t"] == "machine")
    assert machine["m"] == "A-1" and len(machine["dolls"]) == 9
    assert contents.stored["A-1"][:8] == before[1:] and contents.saves == 1  # 뽑힌 인형만 빠지고 하나 새로
    assert ("c-1", bag_msg(3)) in conns.direct and bag.added == [("g-1", "bunny", "big")]
    assert locks.lock_of("c-1") is None


async def test_losing_drop_keeps_the_machine():
    locks, conns, bag, contents, it = setup(roll=0.99)
    await it.drop(DropCommand("c-1", 0.0, 0.0, now=15.0))
    result = next(m for _, m in conns.broadcasts if m["t"] == "result")
    assert result["o"] == "miss" and result["k"] == "bunny"
    assert not any(m["t"] == "machine" for _, m in conns.broadcasts) and bag.added == [] and contents.saves == 0


async def test_late_drop_frees_without_result():
    locks, conns, bag, contents, it = setup(roll=0.1)
    await it.drop(DropCommand("c-1", 0.0, 0.0, now=33.5))
    assert conns.broadcasts == [(None, free("A-1"))] and bag.added == [] and locks.lock_of("c-1") is None


async def test_double_drop_is_ignored():
    locks, conns, bag, contents, it = setup(roll=0.99)
    await it.drop(DropCommand("c-1", 0.0, 0.0, now=15.0))
    before = len(conns.broadcasts)
    await it.drop(DropCommand("c-1", 0.0, 0.0, now=15.5))
    assert len(conns.broadcasts) == before


async def test_drop_without_a_lock_is_ignored():
    locks, conns, bag, contents, it = setup(roll=0.1)
    locks.release("c-1")
    await it.drop(DropCommand("c-1", 0.0, 0.0, now=15.0))
    assert conns.broadcasts == [] and conns.direct == []

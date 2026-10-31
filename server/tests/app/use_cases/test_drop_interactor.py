import math
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
    # 가운데 토끼 하나 + 손이 닿지 않는 오른쪽에 8개 (위층 인형이 집게 근처에 오지 않게 고정)
    stored["A-1"] = [DollSpot("bunny", 0.0, 0.0, 0.0)] + [DollSpot("bear", 0.35, -0.3 + i * 0.08, 0.0) for i in range(8)]
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
    after = contents.stored["A-1"]
    assert after[1:] == before[1:] and (after[0].x, after[0].z) == (0.0, 0.0) and contents.saves == 1  # 뽑힌 자리에 새 인형
    assert ("c-1", bag_msg(3)) in conns.direct and bag.added == [("g-1", "bunny", "big")]


async def test_after_a_drop_the_player_keeps_the_machine_between_plays():
    """한 판이 끝나도 그 사람이 이어서 할 수 있게 자리를 잡아 둔다 (기계는 아직 그 사람 것)."""
    locks, conns, bag, contents, it = setup(roll=0.99)
    await it.drop(DropCommand("c-1", 0.0, 0.0, now=15.0))
    assert locks.lock_of("c-1") == ("A-1", 15.0) and locks.is_between("c-1")
    assert not any(m["t"] == "free" for _, m in conns.broadcasts)


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


async def test_result_reports_where_the_claw_actually_landed():
    """판정은 흔들린 자리로 하고, 모두에게 그 자리를 알려 같은 곳으로 내려가게 한다."""
    reg, locks, conns, bag = FakeRegistry(), FakeLocks({"c-1": "p1"}), FakeConnections(), FakeBag()
    reg.put("c-1", player("p1", guest="g-1"))
    stored = {m: generate_contents(MACHINES[m].set, random.Random(9)) for m in MACHINE_IDS}
    locks.lock("c-1", "A-1", 10.0)
    await DropInteractor(reg, locks, FakeContents(stored), bag, conns, random.Random(2)).drop(DropCommand("c-1", 0.1, -0.1, now=15.0))
    result = next(m for _, m in conns.broadcasts if m["t"] == "result")
    assert (result["x"], result["z"]) != (0.1, -0.1)
    assert math.hypot(result["x"] - 0.1, result["z"] + 0.1) <= 0.071


async def test_slip_moves_the_doll_nearby_and_tells_everyone():
    """놓친 인형은 근처로 굴러가고, 새 배치를 모두에게 알린다. 결과에는 잡은 인형 번호(i)를 싣는다."""
    locks, conns, bag, contents, it = setup(roll=0.3)  # 머리 놓침 구간
    before = list(contents.stored["A-1"])
    await it.drop(DropCommand("c-1", 0.0, 0.0, now=15.0))
    result = next(m for _, m in conns.broadcasts if m["t"] == "result")
    assert result["o"] == "slip" and result["i"] == 0
    machine = next(m for _, m in conns.broadcasts if m["t"] == "machine")
    moved = contents.stored["A-1"][0]
    assert machine["m"] == "A-1" and moved.kind == "bunny" and (moved.x, moved.z) != (0.0, 0.0)
    assert contents.stored["A-1"][1:] == before[1:] and bag.added == []

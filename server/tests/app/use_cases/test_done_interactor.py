import random

from fakes import FakeBag, FakeConnections, FakeContents, FakeLocks, FakeRegistry, player
from toycrane.adapter.inbound.ws.schemas.server_messages import done_no, free, machine, result
from toycrane.app.dtos.done_dto import DoneCommand
from toycrane.app.dtos.play_dto import PlayStartCommand
from toycrane.app.use_cases.done_interactor import DoneInteractor
from toycrane.app.use_cases.play_start_interactor import PlayStartInteractor
from toycrane.domain.layout import MACHINE_IDS, MACHINES, front_spot
from toycrane.domain.report import DollPose, Report
from toycrane.domain.stock import generate_stock
from toycrane.domain.value_objects.position import Position
from fakes import FakeWallet

UP = (0.0, 0.0, 0.0, 1.0)


def setup():
    reg, conns, bag = FakeRegistry(), FakeConnections(), FakeBag()
    locks = FakeLocks({"c-1": "p1", "c-2": "p2"})
    reg.put("c-1", player("p1", guest="g-1"))
    reg.put("c-2", player("p2", guest="g-2"))
    stored = {m: generate_stock(MACHINES[m].kind, random.Random(9)) for m in MACHINE_IDS}
    contents = FakeContents(stored)
    locks.lock("c-1", "A-1", 10.0)
    return reg, locks, conns, bag, contents, DoneInteractor(reg, locks, contents, bag, conns)


def report(stock, won=(), tilt=False):
    q = (0.0, 0.70711, 0.0, 0.70711) if tilt else UP
    return Report(tuple(won), tuple(DollPose(d.uid, d.x, 0.87, d.z, q) for d in stock.dolls if d.uid not in won))


# 물리 뽑기 설계 §4.5·§9.1: 판을 한 화면의 보고를 상식만 확인해 저장하고, 당첨은 모두 가방에, 모두에게 결과와 새 배치
async def test_done_saves_poses_bags_every_win_and_tells_everyone():
    reg, locks, conns, bag, contents, it = setup()
    stock = contents.stored["A-1"]
    won_dolls = [d for d in stock.dolls if d.uid in (7, 8)]
    await it.done(DoneCommand("c-1", "A-1", report(stock, won=(7, 8)), now=20.0))
    assert contents.saves == 1 and [d.uid for d in contents.stored["A-1"].dolls] == [1, 2, 3, 4, 5, 6, 9]
    assert all(d.settled for d in contents.stored["A-1"].dolls) and contents.stored["A-1"].next_at == 50.0
    assert bag.added == [("g-1", MACHINES["A-1"].kind, d.color, d.rare, "big") for d in won_dolls]
    assert ("c-1", {"t": "bag", "n": 2}) in conns.direct
    assert (None, result("A-1", "p1", [(MACHINES["A-1"].kind, d.color, d.rare, d.uid) for d in won_dolls])) in conns.broadcasts
    assert (None, machine("A-1", contents.stored["A-1"].dolls)) in conns.broadcasts
    assert locks.is_between("c-1") and locks.holder("A-1") == ("c-1", 20.0)  # 판 사이 자리


async def test_done_without_a_win_saves_and_tells_everyone():
    reg, locks, conns, bag, contents, it = setup()
    await it.done(DoneCommand("c-1", "A-1", report(contents.stored["A-1"], tilt=True), now=20.0))
    assert contents.saves == 1 and bag.added == [] and contents.stored["A-1"].next_at is None
    assert (None, result("A-1", "p1", [])) in conns.broadcasts
    assert abs(contents.stored["A-1"].dolls[0].q[1] - 0.70711) < 1e-4  # 돌림은 길이 1로 맞춰 저장


# Review Focus 2: 잠근 사람이 아닌 화면의 보고는 무시
async def test_done_from_someone_else_is_refused():
    reg, locks, conns, bag, contents, it = setup()
    await it.done(DoneCommand("c-2", "A-1", report(contents.stored["A-1"], won=(1,)), now=20.0))
    assert contents.saves == 0 and conns.broadcasts == [] and conns.direct == [] and bag.added == []


async def test_done_for_another_machine_than_the_locked_one_is_refused():
    reg, locks, conns, bag, contents, it = setup()
    await it.done(DoneCommand("c-1", "A-2", report(contents.stored["A-2"], won=(1,)), now=20.0))
    assert contents.saves == 0 and conns.broadcasts == []


# Review Focus 5: 치명 규칙에 걸리면 done_no, 기계는 판 시작 전 그대로, 판 사이 자리
async def test_refused_report_keeps_the_machine_and_sends_done_no():
    reg, locks, conns, bag, contents, it = setup()
    before = contents.stored["A-1"]
    bad = Report((), tuple(DollPose(d.uid, d.x, 0.87, d.z, UP) for d in before.dolls[:-1]))
    await it.done(DoneCommand("c-1", "A-1", bad, now=20.0))
    assert conns.direct == [("c-1", done_no("A-1", "count"))] and contents.saves == 0 and contents.stored["A-1"] == before
    assert conns.broadcasts == [] and locks.is_between("c-1")


async def test_done_after_the_lock_expired_is_ignored():
    reg, locks, conns, bag, contents, it = setup()
    await it.done(DoneCommand("c-1", "A-1", report(contents.stored["A-1"], won=(1,)), now=10.0 + 20 + 15 + 3 + 1))
    assert contents.saves == 0 and conns.broadcasts == [(None, free("A-1"))] and locks.holder("A-1") is None


async def test_a_second_done_in_the_same_play_is_ignored():
    reg, locks, conns, bag, contents, it = setup()
    await it.done(DoneCommand("c-1", "A-1", report(contents.stored["A-1"]), now=20.0))
    await it.done(DoneCommand("c-1", "A-1", report(contents.stored["A-1"], won=(1,)), now=21.0))
    assert contents.saves == 1 and bag.added == []


# Review Focus 1: 판 도중 탭을 닫아 보고가 없으면, 잠금 시간이 지난 뒤 다음 사람이 그 기계를 할 수 있고 배치는 판 시작 전 그대로
async def test_no_report_leaves_the_machine_as_it_was():
    reg, locks, conns, bag, contents, it = setup()
    before = contents.stored["A-1"]
    reg.put("c-2", player("p2", guest="g-2", at=front_spot(MACHINES["A-1"])))  # A-1 앞자리
    start = PlayStartInteractor(reg, locks, FakeWallet({"g-2": 3}), conns)
    await start.start(PlayStartCommand("c-2", "A-1", now=10.0 + 20 + 15 + 3 + 1))
    assert locks.holder("A-1")[0] == "c-2" and contents.stored["A-1"] == before and (None, free("A-1")) in conns.broadcasts


# 최종 리뷰 I2: 당첨이 넷이면 조용히 버리지 않고 done_no("wins")를 보낸다 (판 사이 자리는 남는다)
async def test_four_wins_get_done_no():
    reg, locks, conns, bag, contents, it = setup()
    stock = contents.stored["A-1"]
    await it.done(DoneCommand("c-1", "A-1", report(stock, won=(1, 2, 3, 4)), now=20.0))
    assert conns.direct == [("c-1", done_no("A-1", "wins"))] and contents.saves == 0 and locks.is_between("c-1")


# 최종 리뷰 I2: 잠근 사람의 보고가 아예 읽히지 않으면(NaN 등) refuse로 done_no("bad")를 보내고 판 사이로
async def test_unreadable_report_is_refused_with_done_no():
    reg, locks, conns, bag, contents, it = setup()
    await it.refuse(DoneCommand("c-1", "A-1", Report((), ()), now=20.0))
    assert conns.direct == [("c-1", done_no("A-1", "bad"))] and contents.saves == 0 and locks.is_between("c-1")
    await it.refuse(DoneCommand("c-2", "A-1", Report((), ()), now=20.0))  # 잠근 사람이 아니면 아무것도
    assert len(conns.direct) == 1

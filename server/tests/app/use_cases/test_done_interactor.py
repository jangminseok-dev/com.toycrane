import random

from fakes import FakeBag, FakeConnections, FakeContents, FakeLocks, FakeRegistry, player
from toycrane.adapter.inbound.ws.schemas.server_messages import done_no, free, machine, result
from toycrane.app.dtos.done_dto import DoneCommand
from toycrane.app.dtos.play_dto import PlayStartCommand
from toycrane.app.use_cases.done_interactor import DoneInteractor
from toycrane.app.use_cases.play_start_interactor import PlayStartInteractor
from toycrane.domain.layout import MACHINE_IDS, MACHINES, PUSHERS, front_spot
from dataclasses import replace

from toycrane.domain.pusher_crane import PITY_PLAYS, generate_mixed_stock
from toycrane.domain.report import DollPose, Report
from toycrane.domain.shared_data import PUSHER
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
    stored.update({p: generate_mixed_stock(random.Random(9)) for p in PUSHERS})  # 미는 뽑기도 같은 저장(ensure_contents가 더 채우지 않게)
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
    assert contents.stored["A-1"].misses == {"g-1": 1}  # 인형 기계도 연달아 못 뽑은 판을 센다(help.plays판째부터 집게가 세짐)
    assert (None, result("A-1", "p1", [], miss=1)) in conns.broadcasts
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


# 설계 ring-hook §4: 미는 뽑기 당첨은 섞인 인형 그대로(종류는 인형마다) 가방 구역 'pusher'로 — 한 판 여러 개도
async def test_pusher_win_goes_to_the_bag_in_zone_pusher():
    reg, locks, conns, bag, contents, _ = setup()
    contents.stored["P-1"] = generate_mixed_stock(random.Random(3))
    locks.lock("c-2", "P-1", 10.0)
    it = DoneInteractor(reg, locks, contents, bag, conns)
    stock = contents.stored["P-1"]
    won = stock.dolls[-2:]  # 턱 위 인형과 칸의 마지막 인형 — 한 판에 둘
    await it.done(DoneCommand("c-2", "P-1", report(stock, won=tuple(d.uid for d in won)), now=20.0))
    assert bag.added == [("g-2", d.kind, d.color, d.rare, "pusher") for d in won]
    assert len(contents.stored["P-1"].dolls) == len(stock.dolls) - 2 and contents.stored["P-1"].next_at == 50.0
    assert (None, result("P-1", "p2", [(d.kind, d.color, d.rare, d.uid) for d in won])) in conns.broadcasts


# 미는 뽑기는 놓은 뒤 판이 멈출 때까지(settle max) 기다린다 — 겨누기 20초를 다 써도 보고가 늦었다고 버리지 않는다
async def test_a_slow_pusher_report_is_still_taken():
    reg, locks, conns, bag, contents, _ = setup()
    contents.stored["P-1"] = generate_mixed_stock(random.Random(3))
    locks.lock("c-2", "P-1", 10.0)
    it = DoneInteractor(reg, locks, contents, bag, conns)
    await it.done(DoneCommand("c-2", "P-1", report(contents.stored["P-1"]), now=10.0 + 20 + 12 + PUSHER["settle"]["max"] + 2))
    assert contents.saves == 1 and (None, free("P-1")) not in conns.broadcasts


# 15판 보장: 14판 연달아 못 뽑은 사람이 15판째도 못 뽑으면 직원이 턱 맨 앞 인형을 꺼내 준다 — 당첨처럼 가방(pusher)·결과(staff 표시)·
# 기계에서 빠지고, 세던 판 수는 지운다
async def test_the_fifteenth_pusher_miss_gets_a_staff_gift():
    reg, locks, conns, bag, contents, _ = setup()
    stock = generate_mixed_stock(random.Random(3))
    gift = replace(stock.dolls[0], x=-0.3, y=0.99, z=PUSHER["ledge"]["z1"] - 0.02, uid=stock.next_uid)  # 턱 위 앞 끝
    contents.stored["P-1"] = replace(stock, dolls=[*stock.dolls, gift], next_uid=stock.next_uid + 1, misses={"g-2": PITY_PLAYS - 1})
    locks.lock("c-2", "P-1", 10.0)
    it = DoneInteractor(reg, locks, contents, bag, conns)
    await it.done(DoneCommand("c-2", "P-1", report(contents.stored["P-1"]), now=20.0))
    assert bag.added == [("g-2", gift.kind, gift.color, gift.rare, "pusher")]
    after = contents.stored["P-1"]
    assert gift.uid not in {d.uid for d in after.dolls} and "g-2" not in after.misses and after.next_at == 50.0
    assert (None, result("P-1", "p2", [(gift.kind, gift.color, gift.rare, gift.uid)], staff=True)) in conns.broadcasts


async def test_a_pusher_miss_is_counted():
    reg, locks, conns, bag, contents, _ = setup()
    locks.lock("c-2", "P-1", 10.0)
    it = DoneInteractor(reg, locks, contents, bag, conns)
    await it.done(DoneCommand("c-2", "P-1", report(contents.stored["P-1"]), now=20.0))
    assert contents.stored["P-1"].misses == {"g-2": 1} and bag.added == []
    assert (None, result("P-1", "p2", [], miss=1)) in conns.broadcasts  # 화면이 '직원 도움까지 N판'을 알린다


# 인형 기계에서 뽑으면 그 손님의 판 수만 지운다(결과에는 miss 없음)
async def test_a_doll_machine_win_clears_the_miss_count():
    reg, locks, conns, bag, contents, it = setup()
    contents.stored["A-1"] = replace(contents.stored["A-1"], misses={"g-1": 9, "g-2": 4})
    stock = contents.stored["A-1"]
    await it.done(DoneCommand("c-1", "A-1", report(stock, won=(7,)), now=20.0))
    assert contents.stored["A-1"].misses == {"g-2": 4}
    won = [d for d in stock.dolls if d.uid == 7][0]
    assert (None, result("A-1", "p1", [(MACHINES["A-1"].kind, won.color, won.rare, 7)])) in conns.broadcasts


# 직원이 정리: 미는 뽑기 판 뒤 턱 앞에서 3판째 안 움직인 인형은 뒤로 옮겨(안 앉은 채) 저장·배치에 실리고, 결과에 tidied 수가 간다
async def test_a_stuck_ledge_doll_is_tidied_after_a_pusher_play():
    reg, locks, conns, bag, contents, _ = setup()
    stock = generate_mixed_stock(random.Random(3))
    front = replace(stock.dolls[0], x=-0.3, y=0.99, z=PUSHER["ledge"]["z1"] - 0.03, uid=stock.next_uid)
    contents.stored["P-1"] = replace(stock, dolls=[*stock.dolls, front], next_uid=stock.next_uid + 1, stuck={front.uid: 2})
    locks.lock("c-2", "P-1", 10.0)
    it = DoneInteractor(reg, locks, contents, bag, conns)
    stock = contents.stored["P-1"]
    still = Report((), tuple(DollPose(d.uid, d.x, d.y if d.uid == front.uid else 0.87, d.z, UP) for d in stock.dolls))  # 걸린 인형은 그 자리 그대로
    await it.done(DoneCommand("c-2", "P-1", still, now=20.0))
    after = contents.stored["P-1"]
    moved = next(d for d in after.dolls if d.uid == front.uid)
    assert moved.y is None and moved.z < PUSHER["ledge"]["z0"] + 0.13 and front.uid not in after.stuck
    assert (None, result("P-1", "p2", [], miss=1, tidied=1)) in conns.broadcasts
    assert (None, machine("P-1", after.dolls)) in conns.broadcasts


# 판 끝에 바로 채우기: 인형 기계에서 BATCH개째 빠진 판의 결과를 저장하면 빈 자리가 그 자리에서 다 채워져(안 앉은 채) 배치에 실린다
async def test_a_play_that_empties_a_batch_refills_the_machine_at_once():
    from toycrane.domain.stock import BATCH, DOLLS_PER_MACHINE
    reg, locks, conns, bag, contents, it = setup()
    stock = contents.stored["A-1"]
    contents.stored["A-1"] = replace(stock, dolls=stock.dolls[: DOLLS_PER_MACHINE - BATCH + 1])  # BATCH-1개 빈 기계
    stock = contents.stored["A-1"]
    won = stock.dolls[0].uid
    await it.done(DoneCommand("c-1", "A-1", report(stock, won=(won,)), now=20.0))
    after = contents.stored["A-1"]
    assert len(after.dolls) == DOLLS_PER_MACHINE and after.next_at is None
    assert sum(d.y is None for d in after.dolls) == BATCH
    assert (None, machine("A-1", after.dolls)) in conns.broadcasts


# 인형 기계 재배치(2026-11-24): 유리 쪽 못 닿는 자리에서 3판째 안 움직인 인형은 판 끝에 직원이 닿는 빈자리로(안 앉은 채) 옮기고, 결과에 tidied 수
async def test_a_stuck_glass_doll_is_tidied_after_the_third_doll_play():
    from toycrane.domain.crane import REACH_HALF
    from toycrane.domain.shared_data import CLAW

    reg, locks, conns, bag, contents, it = setup()
    stock = contents.stored["A-1"]
    glass = replace(stock.dolls[0], x=REACH_HALF[0] + CLAW["reposition"]["out"] + 0.04, y=0.87, z=0.0)
    contents.stored["A-1"] = replace(stock, dolls=[glass, *stock.dolls[1:]], stuck={glass.uid: 2})
    await it.done(DoneCommand("c-1", "A-1", report(contents.stored["A-1"]), now=20.0))
    after = contents.stored["A-1"]
    moved = next(d for d in after.dolls if d.uid == glass.uid)
    out = CLAW["reposition"]["out"]
    assert moved.y is None and abs(moved.x) <= REACH_HALF[0] + out and abs(moved.z) <= REACH_HALF[1] + out and glass.uid not in after.stuck
    assert (None, result("A-1", "p1", [], miss=1, tidied=1)) in conns.broadcasts
    assert (None, machine("A-1", after.dolls)) in conns.broadcasts

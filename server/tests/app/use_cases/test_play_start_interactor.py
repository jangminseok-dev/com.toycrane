import asyncio

from fakes import FakeConnections, FakeLocks, FakeOccupancy, FakeRegistry, FakeStaffBoard, FakeWallet, player
from toycrane.adapter.inbound.ws.schemas.server_messages import free, play, play_no, play_ok
from toycrane.app.dtos.leave_dto import LeaveCommand
from toycrane.app.dtos.play_dto import PlayStartCommand
from toycrane.app.use_cases.leave_interactor import LeaveInteractor
from toycrane.app.use_cases.play_start_interactor import PlayStartInteractor
from toycrane.domain.layout import MACHINES, front_spot
from toycrane.domain.value_objects.position import Position

FRONT = front_spot(MACHINES["A-1"])  # A-1 앞자리 (배치 파일에서)


class SlowWallet(FakeWallet):
    """코인 쓰기(D1)를 기다리는 사이 다른 요청이 끼어들 수 있게 한 번 양보한다."""

    async def spend_one(self, guest_id, now):
        await asyncio.sleep(0)
        return await super().spend_one(guest_id, now)


def setup(wallet=None, at: Position = FRONT, board=None):
    reg, locks, conns = FakeRegistry(), FakeLocks({"c-1": "p1", "c-2": "p2"}), FakeConnections()
    reg.put("c-1", player("p1", guest="g-1", at=at))
    reg.put("c-2", player("p2", guest="g-2", at=FRONT))
    wallet = wallet or FakeWallet({"g-1": 3, "g-2": 3})
    return reg, locks, conns, wallet, PlayStartInteractor(reg, locks, wallet, conns, board or FakeStaffBoard())


async def test_start_spends_a_coin_and_locks():
    reg, locks, conns, wallet, it = setup()
    await it.start(PlayStartCommand("c-1", "A-1", now=5.0))
    assert conns.direct == [("c-1", play_ok("A-1", 2, 20))]
    assert conns.broadcasts == [("c-1", play("A-1", "p1"))]
    assert locks.holder("A-1") == ("c-1", 5.0) and wallet.coins["g-1"] == 2


async def test_busy_far_and_no_coins():
    reg, locks, conns, wallet, it = setup()
    locks.lock("c-2", "A-1", 4.0)
    await it.start(PlayStartCommand("c-1", "A-1", now=5.0))
    assert conns.direct[-1] == ("c-1", play_no("A-1", "busy"))
    reg2, locks2, conns2, wallet2, it2 = setup(at=Position(FRONT.x, FRONT.z - 2.0))
    await it2.start(PlayStartCommand("c-1", "A-1", now=5.0))
    assert conns2.direct[-1] == ("c-1", play_no("A-1", "far"))
    reg3, locks3, conns3, wallet3, it3 = setup(wallet=FakeWallet({"g-1": 0}))
    await it3.start(PlayStartCommand("c-1", "A-1", now=5.0))
    assert conns3.direct[-1] == ("c-1", play_no("A-1", "coins")) and locks3.holder("A-1") is None


async def test_same_player_continues_between_plays():
    reg, locks, conns, wallet, it = setup()
    locks.hold("c-1", "A-1", 10.0)
    await it.start(PlayStartCommand("c-1", "A-1", now=15.0))
    assert conns.direct == [("c-1", play_ok("A-1", 2, 20))] and conns.broadcasts == [("c-1", play("A-1", "p1"))]
    assert locks.holder("A-1") == ("c-1", 15.0) and not locks.is_between("c-1")


async def test_others_wait_while_the_player_decides():
    reg, locks, conns, wallet, it = setup()
    locks.hold("c-2", "A-1", 10.0)
    await it.start(PlayStartCommand("c-1", "A-1", now=29.0))
    assert conns.direct == [("c-1", play_no("A-1", "busy"))] and wallet.coins["g-1"] == 3


async def test_a_held_machine_frees_after_the_hold_time():
    reg, locks, conns, wallet, it = setup()
    locks.hold("c-2", "A-1", 10.0)
    await it.start(PlayStartCommand("c-1", "A-1", now=30.5))
    assert (None, free("A-1")) in conns.broadcasts
    assert conns.direct == [("c-1", play_ok("A-1", 2, 20))] and locks.holder("A-1") == ("c-1", 30.5)


async def test_starting_another_machine_frees_the_held_one():
    reg, locks, conns, wallet, it = setup()
    locks.hold("c-1", "A-2", 10.0)
    await it.start(PlayStartCommand("c-1", "A-1", now=12.0))
    assert conns.broadcasts[0] == (None, free("A-2"))
    assert conns.direct == [("c-1", play_ok("A-1", 2, 20))] and locks.holder("A-2") is None


async def test_already_playing_and_unknown_machine():
    reg, locks, conns, wallet, it = setup()
    locks.lock("c-1", "A-2", 4.0)
    await it.start(PlayStartCommand("c-1", "A-1", now=5.0))
    await it.start(PlayStartCommand("c-1", "Z-9", now=5.0))
    assert conns.direct == [("c-1", play_no("A-1", "playing"))]


async def test_expired_lock_is_taken_over():
    reg, locks, conns, wallet, it = setup()
    locks.lock("c-2", "A-1", 0.0)
    await it.start(PlayStartCommand("c-1", "A-1", now=30.0))  # 20초 + 집게 한 바퀴 15초 + 여유 3초 안에는 아직 그 사람 판
    assert conns.direct == [("c-1", play_no("A-1", "busy"))]
    await it.start(PlayStartCommand("c-1", "A-1", now=39.0))
    assert (None, free("A-1")) in conns.broadcasts
    assert conns.direct[-1] == ("c-1", play_ok("A-1", 2, 20)) and locks.holder("A-1") == ("c-1", 39.0)


async def test_second_start_during_coin_spend_is_busy():
    reg, locks, conns, wallet, it = setup(wallet=SlowWallet({"g-1": 3, "g-2": 3}))
    await asyncio.gather(it.start(PlayStartCommand("c-1", "A-1", 5.0)), it.start(PlayStartCommand("c-2", "A-1", 5.0)))
    oks = [m for _, m in conns.direct if m["t"] == "play_ok"]
    nos = [m for _, m in conns.direct if m["t"] == "play_no"]
    assert len(oks) == 1 and nos[0]["why"] == "busy" and wallet.spent == 1


async def test_closing_during_coin_spend_sends_no_play_after_free():
    """코인 쓰기(D1)를 기다리는 사이 창이 닫히면, free 뒤에 play가 가서 기계가 영원히 '하는 중'이 되면 안 된다 (최종 리뷰 I2)."""
    reg, locks, conns, wallet, it = setup(wallet=SlowWallet({"g-1": 3}))
    leave = LeaveInteractor(reg, conns, FakeOccupancy(), locks=locks, wallet=wallet)
    await asyncio.gather(it.start(PlayStartCommand("c-1", "A-1", 5.0)), leave.leave(LeaveCommand("c-1", 1, 5.0)))
    kinds = [m["t"] for _, m in conns.broadcasts]
    assert "play" not in kinds and "free" in kinds and locks.holder("A-1") is None
    assert not any(m["t"] == "play_ok" for _, m in conns.direct) and wallet.coins["g-1"] == 3


# 최종 리뷰 I2: 내 잠금이 시간이 지났으면(보고를 못 보낸 판) 다음 play에서 풀고 새로 시작한다 — 아니면 재접속까지 어느 기계도 못 한다
async def test_my_own_expired_lock_is_released_on_the_next_play():
    reg, locks, conns, wallet, it = setup()
    locks.lock("c-1", "A-1", 0.0)
    await it.start(PlayStartCommand("c-1", "A-1", now=40.0))
    assert (None, free("A-1")) in conns.broadcasts
    assert conns.direct[-1] == ("c-1", play_ok("A-1", 2, 20)) and locks.holder("A-1") == ("c-1", 40.0)


# 9단계 피규어 뽑기: 판 잠금·코인·거리 규칙은 인형 기계와 같다
async def test_play_start_accepts_figure_machine():
    from toycrane.domain.layout import FIGURES

    front = front_spot(FIGURES["F-1"])
    reg, locks, conns, wallet, it = setup(at=front)
    await it.start(PlayStartCommand("c-1", "F-1", now=5.0))
    assert conns.direct == [("c-1", play_ok("F-1", 2, 20))]
    assert locks.holder("F-1") == ("c-1", 5.0)
    reg2, locks2, conns2, wallet2, it2 = setup(at=Position(front.x - 3.0, front.z))
    await it2.start(PlayStartCommand("c-1", "F-1", now=5.0))
    assert conns2.direct[-1] == ("c-1", play_no("F-1", "far"))


# 상주 직원(설계 2026-11-24 store-staff): 직원 일이 잡힌 기계는 다시 놓기(put)까지 아무도 시작하지 못한다
async def test_nobody_starts_a_machine_while_staff_is_on_the_way():
    from toycrane.domain.staff import EMPTY_BOARD, plan_call

    called, job = plan_call(EMPTY_BOARD, "A-1", "g-9", 5.0)
    reg, locks, conns, wallet, it = setup(board=FakeStaffBoard(called))
    for conn in ("c-1", "c-2"):
        await it.start(PlayStartCommand(conn, "A-1", now=job.put - 0.1))
    assert conns.direct == [("c-1", play_no("A-1", "staff")), ("c-2", play_no("A-1", "staff"))] and wallet.coins["g-1"] == 3
    await it.start(PlayStartCommand("c-1", "A-1", now=job.put + 0.1))
    assert conns.direct[-1] == ("c-1", play_ok("A-1", 2, 20))


async def test_a_play_start_counts_toward_the_next_call():
    from toycrane.domain.staff import EMPTY_BOARD, plan_call

    called, job = plan_call(EMPTY_BOARD, "A-1", "g-1", 1.0)
    board = FakeStaffBoard(called)
    reg, locks, conns, wallet, it = setup(board=board)
    await it.start(PlayStartCommand("c-1", "A-1", now=job.end + 30))
    assert board.board.calls == {"A-1": {"g-1": 1}}
    await it.start(PlayStartCommand("c-2", "A-2", now=job.end + 30))  # 부른 적 없는 손님·기계는 세지 않는다
    assert board.board.calls == {"A-1": {"g-1": 1}}

import asyncio

from fakes import FakeConnections, FakeLocks, FakeOccupancy, FakeQueues, FakeRegistry, FakeWallet, player
from toycrane.adapter.inbound.ws.schemas.server_messages import free, play, play_no, play_ok
from toycrane.app.dtos.leave_dto import LeaveCommand
from toycrane.app.dtos.play_dto import PlayStartCommand
from toycrane.app.use_cases.leave_interactor import LeaveInteractor
from toycrane.app.use_cases.play_start_interactor import PlayStartInteractor
from toycrane.domain.value_objects.position import Position

FRONT = Position(-11.1, -11.2)  # A-1 앞자리


class SlowWallet(FakeWallet):
    """코인 쓰기(D1)를 기다리는 사이 다른 요청이 끼어들 수 있게 한 번 양보한다."""

    async def spend_one(self, guest_id, now):
        await asyncio.sleep(0)
        return await super().spend_one(guest_id, now)


def setup(wallet=None, at: Position = FRONT):
    reg, locks, conns = FakeRegistry(), FakeLocks({"c-1": "p1", "c-2": "p2"}), FakeConnections()
    reg.put("c-1", player("p1", guest="g-1", at=at))
    reg.put("c-2", player("p2", guest="g-2", at=FRONT))
    wallet = wallet or FakeWallet({"g-1": 3, "g-2": 3})
    return reg, locks, conns, wallet, PlayStartInteractor(reg, locks, wallet, conns)


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
    reg2, locks2, conns2, wallet2, it2 = setup(at=Position(-11.1, -9.2))
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
    await it.start(PlayStartCommand("c-1", "A-1", now=24.0))
    assert (None, free("A-1")) in conns.broadcasts
    assert conns.direct == [("c-1", play_ok("A-1", 2, 20))] and locks.holder("A-1") == ("c-1", 24.0)


async def test_second_start_during_coin_spend_is_busy():
    reg, locks, conns, wallet, it = setup(wallet=SlowWallet({"g-1": 3, "g-2": 3}))
    await asyncio.gather(it.start(PlayStartCommand("c-1", "A-1", 5.0)), it.start(PlayStartCommand("c-2", "A-1", 5.0)))
    oks = [m for _, m in conns.direct if m["t"] == "play_ok"]
    nos = [m for _, m in conns.direct if m["t"] == "play_no"]
    assert len(oks) == 1 and nos[0]["why"] == "busy" and wallet.spent == 1


async def test_closing_during_coin_spend_sends_no_play_after_free():
    """코인 쓰기(D1)를 기다리는 사이 창이 닫히면, free 뒤에 play가 가서 기계가 영원히 '하는 중'이 되면 안 된다 (최종 리뷰 I2)."""
    reg, locks, conns, wallet, it = setup(wallet=SlowWallet({"g-1": 3}))
    leave = LeaveInteractor(reg, conns, FakeOccupancy(), queues=FakeQueues(), locks=locks, wallet=wallet)
    await asyncio.gather(it.start(PlayStartCommand("c-1", "A-1", 5.0)), leave.leave(LeaveCommand("c-1", 1, 5.0)))
    kinds = [m["t"] for _, m in conns.broadcasts]
    assert "play" not in kinds and "free" in kinds and locks.holder("A-1") is None
    assert not any(m["t"] == "play_ok" for _, m in conns.direct) and wallet.coins["g-1"] == 3

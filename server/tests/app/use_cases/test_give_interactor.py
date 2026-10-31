from dataclasses import replace

from fakes import FakeConnections, FakeLocks, FakeRegistry, FakeWallet, player
from toycrane.adapter.inbound.ws.schemas.server_messages import beg, coins, gave, give_no
from toycrane.app.dtos.give_dto import GiveCommand
from toycrane.app.use_cases.give_interactor import GiveInteractor
from toycrane.domain.value_objects.position import Position


def setup(giver_coins: int = 20, receiver_coins: int = 0, receiver_at: Position = Position(1.0, 0.0), begging: bool = True, same_guest: bool = False):
    reg, conns, locks = FakeRegistry(), FakeConnections(), FakeLocks({"c-1": "p1", "c-2": "p2"})
    wallet = FakeWallet({"g-1": giver_coins, "g-2": receiver_coins})
    reg.put("c-1", player("p1", guest="g-1", at=Position(0.0, 0.0)))
    receiver = player("p2", guest="g-1" if same_guest else "g-2", at=receiver_at)
    reg.put("c-2", replace(receiver, beg_room=99 - receiver_coins) if begging else receiver)
    return reg, conns, wallet, locks, GiveInteractor(reg, wallet, conns, locks)


# 코인 주기 (설계 2026-10-31 교환소 개편 §4.4): 주는 사람이 개수를 정하고, 서버가 두 지갑을 한 번에 바꾼다
async def test_give_moves_coins_and_stops_begging():
    reg, conns, wallet, locks, it = setup()
    await it.give(GiveCommand("c-1", "p2", 5, now=1.0))
    assert wallet.coins == {"g-1": 15, "g-2": 5}
    assert (None, beg("p2", None)) in conns.broadcasts and (None, gave("p1", "p2", 5)) in conns.broadcasts
    assert ("c-1", coins(15, -5)) in conns.direct and ("c-2", coins(5, 5)) in conns.direct
    assert dict(reg.entries())["c-2"].beg_room is None


# Review Focus 3: 개수를 고르는 사이 조르던 사람이 그만뒀거나 멀어졌다 — 거절하고 주는 사람 코인은 그대로
async def test_give_to_someone_who_stopped_begging_is_refused():
    reg, conns, wallet, locks, it = setup(begging=False)
    await it.give(GiveCommand("c-1", "p2", 5, now=1.0))
    assert conns.direct == [("c-1", give_no("stopped"))] and wallet.coins["g-1"] == 20


async def test_give_from_afar_is_refused():
    reg, conns, wallet, locks, it = setup(receiver_at=Position(2.0, 0.0))
    await it.give(GiveCommand("c-1", "p2", 5, now=1.0))
    assert conns.direct == [("c-1", give_no("far"))] and wallet.coins["g-1"] == 20


async def test_give_to_yourself_in_another_tab_is_refused():
    reg, conns, wallet, locks, it = setup(same_guest=True)
    await it.give(GiveCommand("c-1", "p2", 5, now=1.0))
    assert conns.direct == [("c-1", give_no("self"))]


async def test_give_to_someone_gone_is_refused():
    reg, conns, wallet, locks, it = setup()
    await it.give(GiveCommand("c-1", "p9", 5, now=1.0))
    assert conns.direct == [("c-1", give_no("gone"))]


async def test_give_more_than_you_have_or_than_fits_is_refused():
    reg, conns, wallet, locks, it = setup(giver_coins=3)
    await it.give(GiveCommand("c-1", "p2", 5, now=1.0))
    assert conns.direct == [("c-1", give_no("poor"))]
    reg, conns, wallet, locks, it = setup(receiver_coins=97)
    await it.give(GiveCommand("c-1", "p2", 5, now=1.0))
    assert conns.direct == [("c-1", give_no("full"))] and wallet.coins == {"g-1": 20, "g-2": 97}


async def test_give_while_playing_is_refused():
    reg, conns, wallet, locks, it = setup()
    locks.lock("c-1", "A-1", 0.0)
    await it.give(GiveCommand("c-1", "p2", 5, now=1.0))
    assert conns.direct == [("c-1", give_no("playing"))]

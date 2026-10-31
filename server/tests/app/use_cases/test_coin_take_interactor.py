from fakes import FakeConnections, FakeQueues, FakeRegistry, FakeWallet, player
from toycrane.adapter.inbound.ws.schemas.server_messages import coins as coins_msg
from toycrane.adapter.inbound.ws.schemas.server_messages import queue as queue_msg
from toycrane.app.dtos.take_dto import TakeCommand
from toycrane.app.use_cases.coin_take_interactor import CoinTakeInteractor
from toycrane.domain.value_objects.position import Position

WINDOW = Position(-5.5, -2.15)  # 교환소 0 창구


def setup(at: Position = WINDOW, coins: int = 3):
    q, conns, reg, wallet = FakeQueues(), FakeConnections(), FakeRegistry(), FakeWallet({"g-1": coins})
    reg.put("c-1", player("p1", guest="g-1", at=at))
    q.join("c-1", 0, 1.0); q.mark_head("c-1", 1.0)
    return q, conns, wallet, CoinTakeInteractor(q, conns, reg, wallet)


async def test_take_gives_five_coins_after_two_seconds_at_the_window():
    q, conns, wallet, it = setup()
    await it.take(TakeCommand("c-1", now=2.8))
    assert conns.direct == [("c-1", coins_msg(8, 5))]
    assert q.members(0) == [] and conns.broadcasts[-1] == (None, queue_msg(0, []))


async def test_take_too_early_or_away_from_window_is_ignored():
    q, conns, wallet, it = setup()
    await it.take(TakeCommand("c-1", now=2.6))
    q2, conns2, wallet2, it2 = setup(at=Position(-5.5, -0.65))
    await it2.take(TakeCommand("c-1", now=3.0))
    assert conns.direct == [] and conns2.direct == []
    assert wallet.coins["g-1"] == 3 and wallet2.coins["g-1"] == 3
    assert len(q.members(0)) == 1 and len(q2.members(0)) == 1


async def test_full_wallet_takes_nothing_but_leaves_the_line():
    q, conns, wallet, it = setup(coins=15)
    await it.take(TakeCommand("c-1", now=3.0))
    assert conns.direct == [("c-1", coins_msg(15, 0))] and q.members(0) == []


async def test_only_the_head_can_take():
    q, conns, wallet, it = setup()
    q.join("c-2", 0, 2.0)
    await it.take(TakeCommand("c-2", now=5.0))
    assert conns.direct == []

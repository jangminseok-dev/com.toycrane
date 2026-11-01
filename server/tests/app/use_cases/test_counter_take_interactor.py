from fakes import FakeConnections, FakeRegistry, FakeWallet, player
from toycrane.adapter.inbound.ws.schemas.server_messages import coins as coins_msg
from toycrane.adapter.inbound.ws.schemas.server_messages import take_no
from toycrane.app.dtos.counter_take_dto import CounterTakeCommand
from toycrane.app.use_cases.counter_take_interactor import CounterTakeInteractor
from toycrane.domain.layout import COUNTERS
from toycrane.domain.value_objects.position import Position

WINDOW = COUNTERS[0].window  # 교환소 0 창구 (배치 파일에서)


def setup(at: Position = WINDOW, coins: int = 3):
    conns, reg, wallet = FakeConnections(), FakeRegistry(), FakeWallet({"g-1": coins})
    reg.put("c-1", player("p1", guest="g-1", at=at))
    return conns, wallet, CounterTakeInteractor(reg, wallet, conns)


# 줄 없이 창구에서 바로 5개, 15개까지 (설계 2026-10-31 교환소 개편 §4.1)
async def test_take_gives_five_up_to_fifteen():
    conns, wallet, it = setup(coins=12)
    await it.take(CounterTakeCommand("c-1", 0, now=1.0))
    assert conns.direct == [("c-1", coins_msg(15, 3))] and wallet.coins["g-1"] == 15


async def test_take_right_away_without_waiting():
    conns, wallet, it = setup(coins=0)
    await it.take(CounterTakeCommand("c-1", 0, now=1.0))
    assert conns.direct == [("c-1", coins_msg(5, 5))]


async def test_take_with_enough_coins_says_so():
    conns, wallet, it = setup(coins=15)
    await it.take(CounterTakeCommand("c-1", 0, now=1.0))
    assert conns.direct == [("c-1", take_no(0, "enough"))] and wallet.coins["g-1"] == 15


async def test_take_from_afar_is_refused():
    conns, wallet, it = setup(at=Position(WINDOW.x, WINDOW.z + 2.0))  # 창구에서 2m
    await it.take(CounterTakeCommand("c-1", 0, now=1.0))
    assert conns.direct == [("c-1", take_no(0, "far"))] and wallet.coins["g-1"] == 3

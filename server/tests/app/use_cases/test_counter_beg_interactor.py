import random

from fakes import FakeConnections, FakeRegistry, FakeWallet, player
from toycrane.adapter.inbound.ws.schemas.server_messages import cbeg, cbeg_no
from toycrane.adapter.inbound.ws.schemas.server_messages import coins as coins_msg
from toycrane.app.dtos.counter_beg_dto import CounterBegCommand
from toycrane.app.use_cases.counter_beg_interactor import CounterBegInteractor
from toycrane.domain.layout import COUNTERS
from toycrane.domain.value_objects.position import Position

WINDOW = COUNTERS[0].window  # 교환소 0 창구 (배치 파일에서)


class Pick(random.Random):
    """randint만 정해 둔 난수."""

    def __init__(self, value: int) -> None:
        super().__init__(1)
        self.value = value

    def randint(self, a: int, b: int) -> int:
        return self.value


def setup(coins: int = 3, begged_at: float | None = None, at: Position = WINDOW, award: int = 37):
    conns, reg, wallet = FakeConnections(), FakeRegistry(), FakeWallet({"g-1": coins})
    if begged_at is not None:
        wallet.begged["g-1"] = begged_at
    reg.put("c-1", player("p1", guest="g-1", at=at))
    return conns, wallet, CounterBegInteractor(reg, wallet, conns, Pick(award))


# 교환소 조르기: 10~50개, 게스트마다 10분에 한 번 (설계 2026-10-31 교환소 개편 §3.2·§4.2)
async def test_counter_beg_grants_and_tells_everyone():
    conns, wallet, it = setup()
    await it.beg(CounterBegCommand("c-1", 0, now=1000.0))
    assert conns.broadcasts == [(None, cbeg("p1", 0, 37))] and conns.direct == [("c-1", coins_msg(40, 37))]
    assert wallet.begged["g-1"] == 1000.0


async def test_counter_beg_within_ten_minutes_is_refused_with_wait():
    conns, wallet, it = setup(begged_at=900.0)
    await it.beg(CounterBegCommand("c-1", 0, now=1200.0))
    assert conns.broadcasts == [(None, cbeg("p1", 0, 0))]  # 모두 시무룩 모션
    assert conns.direct == [("c-1", cbeg_no(0, "wait", 300.0))] and wallet.coins["g-1"] == 3


async def test_counter_beg_with_full_wallet_keeps_the_cooldown():
    conns, wallet, it = setup(coins=99)
    await it.beg(CounterBegCommand("c-1", 0, now=1000.0))
    assert conns.broadcasts == [] and conns.direct == [("c-1", cbeg_no(0, "full", 0.0))] and "g-1" not in wallet.begged


async def test_counter_beg_from_afar_is_refused():
    conns, wallet, it = setup(at=Position(WINDOW.x, WINDOW.z + 2.0))
    await it.beg(CounterBegCommand("c-1", 0, now=1000.0))
    assert conns.direct == [("c-1", cbeg_no(0, "far", 0.0))] and wallet.coins["g-1"] == 3


async def test_counter_beg_never_goes_over_99():
    conns, wallet, it = setup(coins=90, award=40)
    await it.beg(CounterBegCommand("c-1", 0, now=1000.0))
    assert conns.direct == [("c-1", coins_msg(99, 9))] and conns.broadcasts == [(None, cbeg("p1", 0, 9))]

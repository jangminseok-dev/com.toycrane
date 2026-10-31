from dataclasses import replace

from fakes import FakeConnections, FakeLocks, FakeRegistry, FakeWallet, player
from toycrane.adapter.inbound.ws.schemas.server_messages import beg
from toycrane.app.dtos.beg_dto import BegCommand
from toycrane.app.use_cases.beg_interactor import BegInteractor


def setup(coins: int = 5):
    reg, conns, wallet, locks = FakeRegistry(), FakeConnections(), FakeWallet({"g-1": coins}), FakeLocks({"c-1": "p1"})
    reg.put("c-1", player("p1", guest="g-1"))
    return reg, conns, locks, BegInteractor(reg, wallet, conns, locks)


# 맵 조르기 (설계 2026-10-31 교환소 개편 §3.3·§4.3): 그 자리에서 조르는 상태 — 모두에게 보이고, 더 받을 수 있는 수를 함께 알린다
async def test_begging_shows_to_everyone_with_room():
    reg, conns, locks, it = setup(coins=5)
    await it.beg(BegCommand("c-1", True, now=1.0))
    assert conns.broadcasts == [(None, beg("p1", 94))] and dict(reg.entries())["c-1"].beg_room == 94


async def test_stop_begging_tells_everyone():
    reg, conns, locks, it = setup()
    await it.beg(BegCommand("c-1", True, now=1.0))
    await it.beg(BegCommand("c-1", False, now=2.0))
    assert conns.broadcasts[-1] == (None, beg("p1", None)) and dict(reg.entries())["c-1"].beg_room is None


async def test_cannot_beg_while_playing():
    reg, conns, locks, it = setup()
    locks.lock("c-1", "A-1", 0.0)
    await it.beg(BegCommand("c-1", True, now=1.0))
    assert conns.broadcasts == [] and dict(reg.entries())["c-1"].beg_room is None

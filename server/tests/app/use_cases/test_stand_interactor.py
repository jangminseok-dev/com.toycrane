from fakes import FakeConnections, FakeLocks
from toycrane.adapter.inbound.ws.schemas.server_messages import free
from toycrane.app.dtos.play_dto import StandCommand
from toycrane.app.use_cases.stand_interactor import StandInteractor


async def test_stand_between_plays_frees_the_machine():
    locks, conns = FakeLocks(), FakeConnections()
    locks.hold("c-1", "A-1", 10.0)
    await StandInteractor(locks, conns).stand(StandCommand("c-1", now=12.0))
    assert conns.broadcasts == [(None, free("A-1"))] and locks.holder("A-1") is None


async def test_stand_mid_play_frees_the_machine_without_refund():
    """이어 하는 둘째 판부터는 판 도중에도 그만하기가 있다(사용자 2026-11-01) — 그 판은 버리고 바로 일어난다. 코인은 돌려주지 않는다(§4.5)."""
    locks, conns = FakeLocks(), FakeConnections()
    locks.lock("c-1", "A-1", 10.0)
    await StandInteractor(locks, conns).stand(StandCommand("c-1", now=12.0))
    assert (None, free("A-1")) in conns.broadcasts and locks.holder("A-1") is None


async def test_stand_without_a_machine_is_ignored():
    conns = FakeConnections()
    await StandInteractor(FakeLocks(), conns).stand(StandCommand("c-1", now=12.0))
    assert conns.broadcasts == []

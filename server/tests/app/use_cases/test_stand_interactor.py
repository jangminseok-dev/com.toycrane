from fakes import FakeConnections, FakeLocks
from toycrane.adapter.inbound.ws.schemas.server_messages import free
from toycrane.app.dtos.play_dto import StandCommand
from toycrane.app.use_cases.stand_interactor import StandInteractor


async def test_stand_between_plays_frees_the_machine():
    locks, conns = FakeLocks(), FakeConnections()
    locks.hold("c-1", "A-1", 10.0)
    await StandInteractor(locks, conns).stand(StandCommand("c-1", now=12.0))
    assert conns.broadcasts == [(None, free("A-1"))] and locks.holder("A-1") is None


async def test_stand_mid_play_is_ignored():
    """한 판 도중에는 버튼이 없다 — 늦게 온 메시지로 판이 사라지면 안 된다."""
    locks, conns = FakeLocks(), FakeConnections()
    locks.lock("c-1", "A-1", 10.0)
    await StandInteractor(locks, conns).stand(StandCommand("c-1", now=12.0))
    assert conns.broadcasts == [] and locks.holder("A-1") == ("c-1", 10.0)


async def test_stand_without_a_machine_is_ignored():
    conns = FakeConnections()
    await StandInteractor(FakeLocks(), conns).stand(StandCommand("c-1", now=12.0))
    assert conns.broadcasts == []

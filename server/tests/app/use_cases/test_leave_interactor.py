from fakes import BrokenOccupancy, FakeConnections, FakeLocks, FakeOccupancy, FakeRegistry, FakeWallet, player
from toycrane.adapter.inbound.ws.schemas.server_messages import leave
from toycrane.adapter.inbound.ws.schemas.server_messages import free
from toycrane.app.dtos.leave_dto import LeaveCommand
from toycrane.app.use_cases.leave_interactor import LeaveInteractor as _LeaveInteractor


def LeaveInteractor(reg, conns, occ, locks=None, wallet=None):  # noqa: N802 — 1단계 테스트 호출 모양을 그대로 쓰려고
    return _LeaveInteractor(reg, conns, occ, locks=locks or FakeLocks(), wallet=wallet or FakeWallet())


async def test_leave_removes_broadcasts_and_writes_count():
    reg = FakeRegistry()
    reg.put("c-1", player("p-1"))
    reg.put("c-2", player("p-2"))
    conns, occ = FakeConnections(), FakeOccupancy()
    await LeaveInteractor(reg, conns, occ).leave(LeaveCommand("c-1", 1, now=5.0))
    assert conns.broadcasts == [("c-1", leave("p-1"))] and occ.writes == [(1, 1, 5.0)]


async def test_leave_unknown_connection_is_noop():
    conns = FakeConnections()
    await LeaveInteractor(FakeRegistry(), conns, FakeOccupancy()).leave(LeaveCommand("c-x", 1, 0.0))
    assert conns.broadcasts == []


async def test_leave_survives_occupancy_write_failure():
    reg = FakeRegistry()
    reg.put("c-1", player("p-1"))
    conns = FakeConnections()
    await LeaveInteractor(reg, conns, BrokenOccupancy()).leave(LeaveCommand("c-1", 1, now=5.0))
    assert reg.entries() == [] and conns.broadcasts == [("c-1", leave("p-1"))]


async def test_leave_mid_play_refunds_and_frees():
    reg, conns, locks, wallet = FakeRegistry(), FakeConnections(), FakeLocks(), FakeWallet({"g-1": 2})
    reg.put("c-1", player("p1", guest="g-1"))
    locks.lock("c-1", "A-1", 3.0)
    await LeaveInteractor(reg, conns, FakeOccupancy(), locks=locks, wallet=wallet).leave(LeaveCommand("c-1", 1, now=5.0))
    assert wallet.coins["g-1"] == 3 and (None, free("A-1")) in conns.broadcasts and locks.holder("A-1") is None


async def test_leave_between_plays_frees_without_refund():
    reg, conns, locks, wallet = FakeRegistry(), FakeConnections(), FakeLocks(), FakeWallet({"g-1": 2})
    reg.put("c-1", player("p1", guest="g-1"))
    locks.hold("c-1", "A-1", 3.0)
    await LeaveInteractor(reg, conns, FakeOccupancy(), locks=locks, wallet=wallet).leave(LeaveCommand("c-1", 1, now=5.0))
    assert wallet.coins["g-1"] == 2 and (None, free("A-1")) in conns.broadcasts and locks.holder("A-1") is None

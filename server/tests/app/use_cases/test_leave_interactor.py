from fakes import FakeConnections, FakeOccupancy, FakeRegistry, player
from toycrane.adapter.inbound.ws.schemas.server_messages import leave
from toycrane.app.dtos.leave_dto import LeaveCommand
from toycrane.app.use_cases.leave_interactor import LeaveInteractor


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

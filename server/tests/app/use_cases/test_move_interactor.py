from fakes import FakeConnections, FakeRegistry, player
from toycrane.adapter.inbound.ws.schemas.server_messages import correct, move
from toycrane.app.dtos.move_dto import MoveCommand
from toycrane.app.dtos.player_view import PlayerView
from toycrane.app.use_cases.move_interactor import MoveInteractor
from toycrane.domain.value_objects.heading import Heading
from toycrane.domain.value_objects.position import Position


async def test_move_updates_and_broadcasts_to_others():
    reg = FakeRegistry()
    reg.put("c-1", player("p-1", at=Position(0, 3), updated_at=0.0))
    conns = FakeConnections()
    await MoveInteractor(reg, conns).move(MoveCommand("c-1", 1.5, 3, 1, 0, now=0.5))
    moved = dict(reg.entries())["c-1"]
    assert moved.position == Position(1.5, 3) and moved.heading == Heading(1, 0) and moved.updated_at == 0.5
    assert conns.broadcasts == [("c-1", move(PlayerView.of(moved)))] and conns.direct == []


async def test_snapped_move_sends_correction_to_sender():
    reg = FakeRegistry()
    reg.put("c-1", player("p-1", at=Position(0, 3), heading=Heading(1, 0), updated_at=0.0))
    conns = FakeConnections()
    await MoveInteractor(reg, conns).move(MoveCommand("c-1", 9, 3, 1, 0, now=0.5))
    assert conns.direct == [("c-1", correct(1.6, 3))]


async def test_move_from_unknown_connection_is_ignored():
    conns = FakeConnections()
    await MoveInteractor(FakeRegistry(), conns).move(MoveCommand("c-x", 1, 1, 0, 0, now=1.0))
    assert conns.broadcasts == [] and conns.direct == []

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
    assert conns.direct == [("c-1", correct(3.0, 3))]  # 예산(0.6 + 0.5초×4.8)만큼만 이동
    assert dict(reg.entries())["c-1"].budget == 0


async def test_move_from_unknown_connection_is_ignored():
    conns = FakeConnections()
    await MoveInteractor(FakeRegistry(), conns).move(MoveCommand("c-x", 1, 1, 0, 0, now=1.0))
    assert conns.broadcasts == [] and conns.direct == []



# 움직이면 맵 조르기가 끝난다 (설계 2026-10-31 교환소 개편 §4.3) — 멈춘 채 보내는 위치는 조르기를 끝내지 않는다
async def test_moving_stops_begging():
    from dataclasses import replace

    from toycrane.adapter.inbound.ws.schemas.server_messages import beg

    reg, conns = FakeRegistry(), FakeConnections()
    reg.put("c-1", replace(player("p1"), beg_room=50))
    it = MoveInteractor(reg, conns)
    await it.move(MoveCommand("c-1", 0.0, 0.0, 0.0, 0.0, now=0.5))
    assert dict(reg.entries())["c-1"].beg_room == 50 and conns.broadcasts[-1][1]["t"] == "move"
    await it.move(MoveCommand("c-1", 0.1, 0.0, 1.0, 0.0, now=1.0))
    assert dict(reg.entries())["c-1"].beg_room is None and (None, beg("p1", None)) in conns.broadcasts

import math

import pytest

from fakes import FakeConnections, FakeOccupancy, FakeRegistry, player
from toycrane.adapter.inbound.ws.schemas.server_messages import join, leave, welcome
from toycrane.app.dtos.enter_dto import EnterCommand, StoreFull
from toycrane.app.use_cases.enter_interactor import EnterInteractor


async def test_enter_spawns_and_returns_others():
    reg = FakeRegistry()
    reg.put("c-1", player("p-1", guest="g-1"))
    conns, occ = FakeConnections(), FakeOccupancy()
    result = await EnterInteractor(reg, conns, occ, new_player_id=lambda: "p-2").enter(
        EnterCommand("c-2", "g-2", "토끼", 3, 1, now=10.0, seed=7)
    )
    assert result.you.id == "p-2" and math.isclose(math.hypot(result.you.x, result.you.z), 2.4)
    assert [o.id for o in result.others] == ["p-1"]
    assert conns.broadcasts == [("c-2", join(result.you))]  # 본인 제외 전체에게 join
    assert conns.direct == [("c-2", welcome(1, result.you, list(result.others)))]  # 본인에게 welcome
    assert occ.writes == [(1, 2, 10.0)]


async def test_enter_full_store_raises_and_adds_nothing():
    reg = FakeRegistry()
    for i in range(50):
        reg.put(f"c-{i}", player(f"p-{i}", guest=f"g-{i}"))
    with pytest.raises(StoreFull):
        await EnterInteractor(reg, FakeConnections(), FakeOccupancy(), lambda: "p-x").enter(
            EnterCommand("c-new", "g-new", "토끼", 0, 1, 0.0, 0)
        )
    assert len(reg.entries()) == 50


async def test_same_guest_second_tab_kicks_first():
    reg = FakeRegistry()
    reg.put("c-old", player("p-old", guest="g-1"))
    conns = FakeConnections()
    await EnterInteractor(reg, conns, FakeOccupancy(), lambda: "p-new").enter(EnterCommand("c-new", "g-1", "토끼", 3, 1, 0.0, 0))
    assert conns.kicked == [("c-old", 4003)]
    assert [c for c, _ in reg.entries()] == ["c-new"]
    assert ("c-new", leave("p-old")) in conns.broadcasts

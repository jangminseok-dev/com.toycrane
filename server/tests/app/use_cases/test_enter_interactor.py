import math
import random

import pytest

from fakes import (
    BrokenOccupancy, FakeBag, FakeConnections, FakeContents, FakeLocks, FakeOccupancy, FakeQueues, FakeRegistry, FakeWallet, player,
)
from toycrane.adapter.inbound.ws.schemas.server_messages import join, leave
from toycrane.app.dtos.enter_dto import EnterCommand, StoreFull
from toycrane.app.use_cases.enter_interactor import EnterInteractor


def enter_interactor(reg=None, conns=None, occ=None, new_id=lambda: "p-1", wallet=None, bag=None, contents=None, queues=None, locks=None):
    return EnterInteractor(
        reg or FakeRegistry(), conns or FakeConnections(), occ or FakeOccupancy(), new_player_id=new_id,
        wallet=wallet or FakeWallet(), bag=bag or FakeBag(), contents=contents or FakeContents(),
        queues=queues or FakeQueues(), locks=locks or FakeLocks(), rng=random.Random(1),
    )


def cmd(conn: str, guest: str, now: float = 0.0) -> EnterCommand:
    return EnterCommand(conn, guest, "토끼", 3, 1, now, 0)


async def test_enter_spawns_and_returns_others():
    reg = FakeRegistry()
    reg.put("c-1", player("p-1", guest="g-1"))
    conns, occ = FakeConnections(), FakeOccupancy()
    result = await enter_interactor(reg, conns, occ, new_id=lambda: "p-2").enter(
        EnterCommand("c-2", "g-2", "토끼", 3, 1, now=10.0, seed=7)
    )
    assert result.you.id == "p-2" and math.isclose(math.hypot(result.you.x, result.you.z), 2.4)
    assert [o.id for o in result.others] == ["p-1"]
    assert conns.broadcasts == [("c-2", join(result.you))]  # 본인 제외 전체에게 join
    (to, msg), = conns.direct  # 본인에게 welcome
    assert to == "c-2" and msg["t"] == "welcome" and msg["you"]["id"] == "p-2" and [p["id"] for p in msg["players"]] == ["p-1"]
    assert occ.writes == [(1, 2, 10.0)]


async def test_enter_full_store_raises_and_adds_nothing():
    reg = FakeRegistry()
    for i in range(50):
        reg.put(f"c-{i}", player(f"p-{i}", guest=f"g-{i}"))
    occ = FakeOccupancy()
    with pytest.raises(StoreFull):
        await enter_interactor(reg, FakeConnections(), occ, lambda: "p-x").enter(
            EnterCommand("c-new", "g-new", "토끼", 0, 1, 7.0, 0)
        )
    assert len(reg.entries()) == 50
    # 실제 인원을 다시 적는다 — 기록이 실제보다 적게 남아 같은 매장으로 계속 배정되는 것을 막는다 (최종 리뷰 #1)
    assert occ.writes == [(1, 50, 7.0)]


async def test_enter_survives_occupancy_write_failure():
    # 인원 기록은 배정 참고용일 뿐 — D1 쓰기 한도가 차도 입장은 된다 (최종 리뷰 #10)
    reg, conns = FakeRegistry(), FakeConnections()
    result = await enter_interactor(reg, conns, BrokenOccupancy(), lambda: "p-1").enter(cmd("c-1", "g-1"))
    assert result.you.id == "p-1" and [c for c, _ in reg.entries()] == ["c-1"]


async def test_same_guest_second_tab_kicks_first():
    reg = FakeRegistry()
    reg.put("c-old", player("p-old", guest="g-1"))
    conns = FakeConnections()
    await enter_interactor(reg, conns, FakeOccupancy(), lambda: "p-new").enter(cmd("c-new", "g-1"))
    assert conns.kicked == [("c-old", 4003)]
    assert [c for c, _ in reg.entries()] == ["c-new"]
    assert ("c-new", leave("p-old")) in conns.broadcasts


async def test_welcome_carries_coins_bag_and_machines():
    conns, contents = FakeConnections(), FakeContents()
    it = enter_interactor(conns=conns, wallet=FakeWallet({"g-1": 7}), bag=FakeBag({"g-1": 2}), contents=contents)
    await it.enter(cmd("c-1", "g-1"))
    snap = conns.direct[0][1]
    assert snap["coins"] == 7 and snap["bag"] == 2
    assert len(snap["machines"]) == 35 and all(len(v) == 9 for v in snap["machines"].values())
    assert snap["queues"] == [[], []] and snap["plays"] == {}
    assert contents.saves == 1


async def test_second_enter_reuses_saved_machines():
    contents = FakeContents()
    await enter_interactor(contents=contents).enter(cmd("c-1", "g-1"))
    await enter_interactor(contents=contents, new_id=lambda: "p-2").enter(cmd("c-2", "g-2"))
    assert contents.saves == 1


async def test_welcome_shows_who_is_in_line_and_playing():
    conns, queues, locks = FakeConnections(), FakeQueues({"c-9": "p-9"}), FakeLocks({"c-8": "p-8"})
    queues.join("c-9", 1, 0.0)
    locks.lock("c-8", "A-3", 0.0)
    await enter_interactor(conns=conns, queues=queues, locks=locks).enter(cmd("c-1", "g-1"))
    snap = conns.direct[0][1]
    assert snap["queues"] == [[], ["p-9"]] and snap["plays"] == {"A-3": "p-8"}

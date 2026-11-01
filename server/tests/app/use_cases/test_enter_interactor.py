import asyncio
import math
import random

import pytest

from fakes import (
    BrokenOccupancy, FakeBag, FakeConnections, FakeContents, FakeFigureBoxes, FakeLocks, FakeOccupancy, FakeRegistry, FakeWallet, player,
    stocks_with_empty,
)
from toycrane.adapter.inbound.ws.schemas.server_messages import join, leave
from toycrane.app.dtos.enter_dto import EnterCommand, StoreFull
from toycrane.app.dtos.stock_dto import StockCommand
from toycrane.app.use_cases.enter_interactor import EnterInteractor
from toycrane.app.use_cases.stock_interactor import StockInteractor


def enter_interactor(reg=None, conns=None, occ=None, new_id=lambda: "p-1", wallet=None, bag=None, contents=None, locks=None):
    return EnterInteractor(
        reg or FakeRegistry(), conns or FakeConnections(), occ or FakeOccupancy(), new_player_id=new_id,
        wallet=wallet or FakeWallet(), bag=bag or FakeBag(), contents=contents or FakeContents(), figures=FakeFigureBoxes(),
        locks=locks or FakeLocks(), rng=random.Random(1),
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
    assert result.you.id == "p-2" and math.isclose(math.hypot(result.you.x, result.you.z), SPAWN_RADIUS)
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
    assert len(snap["machines"]) == 24 and all(len(v) == 9 for v in snap["machines"].values())
    assert "queues" not in snap and snap["plays"] == {}
    assert contents.saves == 1


async def test_second_enter_reuses_saved_machines():
    contents = FakeContents()
    await enter_interactor(contents=contents).enter(cmd("c-1", "g-1"))
    await enter_interactor(contents=contents, new_id=lambda: "p-2").enter(cmd("c-2", "g-2"))
    assert contents.saves == 1


async def test_welcome_shows_who_is_in_line_and_playing():
    conns, locks = FakeConnections(), FakeLocks({"c-8": "p-8"})
    locks.lock("c-8", "A-3", 0.0)
    await enter_interactor(conns=conns, locks=locks).enter(cmd("c-1", "g-1"))
    snap = conns.direct[0][1]
    assert snap["plays"] == {"A-3": "p-8"}


# ---- 최종 리뷰 C1·I1 ----
from toycrane.adapter.inbound.ws.schemas.server_messages import free  # noqa: E402
from toycrane.domain.store_rules import SPAWN_RADIUS


async def test_kicked_tab_mid_play_is_freed_without_refund():
    """같은 게스트가 다시 들어오면(네트워크 바뀜·두 번째 탭) 이전 접속이 쥔 기계를 정리한다. 코인은 돌려주지 않는다 —
    결과를 화면에서 보고 새로 고침하면 공짜 연습이 된다 (물리 뽑기 설계 §4.5, 최종 리뷰 I1)."""
    reg, conns, locks, wallet = FakeRegistry(), FakeConnections(), FakeLocks(), FakeWallet({"g-1": 2})
    reg.put("c-old", player("p-old", guest="g-1"))
    locks.lock("c-old", "A-1", 3.0)
    reg.put("c-2", player("p2", guest="g-2"))
    await enter_interactor(reg, conns, wallet=wallet, locks=locks, new_id=lambda: "p-new").enter(cmd("c-new", "g-1", now=5.0))
    assert wallet.coins["g-1"] == 2 and locks.holder("A-1") is None
    assert (None, free("A-1")) in conns.broadcasts
    welcome_msg = next(m for c, m in conns.direct if c == "c-new")
    assert welcome_msg["coins"] == 2 and welcome_msg["plays"] == {}


class WatchingWallet(FakeWallet):
    """D1을 기다리는 동안 매장 목록이 어떤지 본다."""

    def __init__(self, registry, balances) -> None:
        super().__init__(balances)
        self.registry, self.seen = registry, None

    async def balance(self, guest_id):
        self.seen = [c for c, _ in self.registry.entries()]
        await asyncio.sleep(0)
        return await super().balance(guest_id)


async def test_store_reads_happen_before_the_player_is_placed():
    """put과 welcome 사이에 D1을 기다리면 그 사이 온 leave·join을 welcome이 덮는다 (최종 리뷰 I1)."""
    reg = FakeRegistry(); reg.put("c-1", player("p1", guest="g-1"))
    wallet = WatchingWallet(reg, {"g-2": 4})
    await enter_interactor(reg, wallet=wallet, new_id=lambda: "p2").enter(cmd("c-2", "g-2"))
    assert wallet.seen == ["c-1"]  # 새 사람은 아직 목록에 없다


class BrokenWallet(FakeWallet):
    async def balance(self, guest_id):
        raise RuntimeError("D1 read failed")


async def test_enter_survives_wallet_read_failure():
    conns = FakeConnections()
    await enter_interactor(conns=conns, wallet=BrokenWallet()).enter(cmd("c-1", "g-1"))
    assert conns.direct[0][1]["t"] == "welcome" and conns.direct[0][1]["coins"] == 0


# Review Focus 1: 몇 시간 비어 있던 매장에 처음 들어와도 입장 화면에 이미 채워진 기계가 보인다 (입장 전에 채우기를 돌린다 — enter_handler)
async def test_enter_sees_the_caught_up_stock():
    conns, contents = FakeConnections(), FakeContents(stocks_with_empty("A-1", next_at=30.0), due=30.0)
    await StockInteractor(contents, FakeLocks(), conns, random.Random(3)).refill(StockCommand(now=4000.0))
    await enter_interactor(conns=conns, contents=contents).enter(cmd("c-1", "g-1", now=4000.0))
    welcome = next(m for c, m in conns.direct if m["t"] == "welcome")
    assert len(welcome["machines"]["A-1"]) == 9

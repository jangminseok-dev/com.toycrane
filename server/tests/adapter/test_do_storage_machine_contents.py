import random

from fakes import FakeStorage, stocks_with_empty
from toycrane.adapter.outbound.do_storage_machine_contents import DoStorageMachineContents
from toycrane.app.use_cases.machine_contents import ensure_contents
from toycrane.domain.pusher_crane import FULL


# 옛 저장(machines_v2)은 읽지 않고 새로 채운다
async def test_old_storage_is_replaced_by_fresh_stock():
    storage = FakeStorage({"machines_v2": '{"A-1": [["bunny",0,0,0,0]]}'})
    stocks = await ensure_contents(DoStorageMachineContents(storage, "s-old", object()), random.Random(1))
    assert len(stocks) == 28 and all(len(s.dolls) == (FULL if m.startswith("P-") else 9) for m, s in stocks.items())


# 물리 뽑기 설계 §6: v3(x, z, 돌림, 높이)는 자리만 남기고 모두 안 앉은 인형으로 읽는다 — 첫 화면이 물리로 앉힌다
async def test_v3_contents_are_read_as_unsettled_v4():
    v3 = '{"A-1": {"d": [["bunny", 0.12, -0.05, 1.57, 0.0, 2, "n", 1, "", 1], ["bunny", -0.2, 0.1, 3.1, 0.21, 0, "c", 3, "star", 2]], "n": 30.0, "u": 10}}'
    storage = FakeStorage({"machines_v3": v3})
    stocks = await DoStorageMachineContents(storage, "s-v3", object()).load()
    dolls = stocks["A-1"].dolls
    assert [(d.uid, d.x, d.z, d.y, d.q, d.color, d.rare) for d in dolls] == [(1, 0.12, -0.05, None, (0, 0, 0, 1), 2, ""), (2, -0.2, 0.1, None, (0, 0, 0, 1), 0, "star")]
    assert stocks["A-1"].next_at == 30.0 and stocks["A-1"].next_uid == 10


# 인형 리뉴얼 설계 §5.3: v4(옛 모양으로 앉힌 자리)는 자리만 남기고 모두 안 앉은 인형으로 읽는다
async def test_v4_contents_are_read_as_unsettled_v5():
    v4 = '{"A-1": {"d": [["bunny", 0.12, 0.9, -0.05, 0.1, 0.2, 0.3, 0.9, 2, "n", 1, "", 1]], "n": 30.0, "u": 10}}'
    stocks = await DoStorageMachineContents(FakeStorage({"machines_v4": v4}), "s-v4", object()).load()
    d = stocks["A-1"].dolls[0]
    assert (d.uid, d.x, d.z, d.y, d.q, d.color, d.face) == (1, 0.12, -0.05, None, (0, 0, 0, 1), 2, 1)
    assert stocks["A-1"].next_at == 30.0 and stocks["A-1"].next_uid == 10


async def test_save_writes_thirteen_fields_and_v6_wins_over_older():
    storage, owner = FakeStorage({"machines_v4": '{"A-1": {"d": [], "n": null, "u": 1}}', "machines_v5": '{"A-1": {"d": [], "n": null, "u": 2}}'}), object()
    stocks = stocks_with_empty("A-1", next_at=30.0)
    await DoStorageMachineContents(storage, "s-13", owner).save(stocks)
    import json
    saved = json.loads(storage.data["machines_v6"])
    assert all(len(d) == 13 for v in saved.values() for d in v["d"])
    assert await DoStorageMachineContents(storage, "s-13", owner).load() == stocks


async def test_stock_round_trips_with_variants_and_refill_time():
    storage, owner = FakeStorage({}), object()
    stocks = stocks_with_empty("A-1", next_at=30.0)
    await DoStorageMachineContents(storage, "s-rt", owner).save(stocks)
    assert await DoStorageMachineContents(storage, "s-rt", owner).load() == stocks


# 걷기 메시지마다 저장소를 읽지 않게: 다음 채울 시각은 이 DO가 저장할 때 기억해 둔다 (무료 한도)
async def test_due_time_is_read_from_storage_once():
    storage, owner = FakeStorage({}), object()
    await DoStorageMachineContents(storage, "s-1", owner).save(stocks_with_empty("A-1", next_at=30.0))
    storage.gets = 0
    assert [await DoStorageMachineContents(storage, "s-1", owner).due_at() for _ in range(3)] == [30.0] * 3 and storage.gets == 0


async def test_a_woken_store_reads_its_due_time_once():
    storage = FakeStorage({})
    await DoStorageMachineContents(storage, "s-2", object()).save(stocks_with_empty("A-1", next_at=30.0))
    woken, owner = FakeStorage(storage.data), object()  # 잠들었다 깨서 새로 만들어진 DO (같은 매장, 새 인스턴스)
    assert [await DoStorageMachineContents(woken, "s-2", owner).due_at() for _ in range(2)] == [30.0] * 2 and woken.gets == 1


# 모듈 메모리는 isolate 것이다: 이 DO가 다른 isolate에서 다시 만들어져 저장한 뒤 돌아와도 옛 값을 쓰지 않는다 (최종 리뷰 I1)
async def test_a_store_rebuilt_elsewhere_rereads_its_due_time():
    storage = FakeStorage({})
    await DoStorageMachineContents(storage, "s-3", object()).save(stocks_with_empty("A-1", next_at=30.0))
    storage.data["stock_due"] = "90.0"  # 다른 인스턴스가 그 사이 저장했다
    storage.gets = 0
    assert await DoStorageMachineContents(storage, "s-3", object()).due_at() == 90.0 and storage.gets == 1


# 2026-11-02 미는 뽑기 턱을 뒤로 물리고 앞 끝을 당겼다(출구에 인형이 끼었다) — v5 미는 뽑기의 턱 위 인형(턱 오른쪽 끝보다 왼쪽)은
# 새 턱 밖(출구 위)에 떠 있을 수 있어 안 앉은 인형으로 읽는다(첫 화면이 물리로 다시 앉힘 — 출구로 빠지면 칸에 다시 떨어뜨림).
# 칸 무더기와 인형 기계는 그대로
async def test_v5_pusher_ledge_dolls_are_read_as_unsettled():
    v5 = (
        '{"P-1": {"d": [["bear", -0.3, 0.99, 0.35, 0, 0, 0, 1, 1, "n", 0, "", 1], ["cat", 0.2, 0.9, 0.1, 0, 0.1, 0, 0.99, 2, "n", 0, "", 2]], "n": null, "u": 3},'
        ' "A-1": {"d": [["bunny", -0.3, 0.95, 0.2, 0, 0, 0, 1, 2, "n", 1, "", 1]], "n": null, "u": 2}}'
    )
    stocks = await DoStorageMachineContents(FakeStorage({"machines_v5": v5}), "s-v5", object()).load()
    ledge, pile = stocks["P-1"].dolls
    assert (ledge.uid, ledge.x, ledge.z, ledge.y, ledge.q) == (1, -0.3, 0.35, None, (0, 0, 0, 1))
    assert (pile.uid, pile.y, pile.q) == (2, 0.9, (0, 0.1, 0, 0.99))
    assert stocks["A-1"].dolls[0].y == 0.95

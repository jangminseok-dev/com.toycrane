import random

from fakes import FakeStorage, stocks_with_empty
from toycrane.adapter.outbound.do_storage_machine_contents import DoStorageMachineContents
from toycrane.app.use_cases.machine_contents import ensure_contents


# Review Focus 5: 옛 저장(machines_v2)은 읽지 않고 새로 채운다
async def test_old_storage_is_replaced_by_fresh_stock():
    storage = FakeStorage({"machines_v2": '{"A-1": [["bunny",0,0,0,0]]}'})
    stocks = await ensure_contents(DoStorageMachineContents(storage, "s-old", object()), random.Random(1))
    assert len(stocks) == 24 and all(len(s.dolls) == 9 for s in stocks.values())


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

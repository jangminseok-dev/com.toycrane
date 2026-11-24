import random

from fakes import FakeConnections, FakeContents, FakeLocks, FakeStaffBoard, stocks_with_empty
from toycrane.app.dtos.stock_dto import StockCommand
from toycrane.app.use_cases.stock_interactor import StockInteractor


class Rolls(random.Random):
    """random()만 정해 둔 난수 (자리·효과 고르기는 그대로)."""

    def __init__(self, value: float) -> None:
        super().__init__(1)
        self.value = value

    def random(self) -> float:
        return self.value


def run(contents, now, locks=None, roll=0.5, conns=None, board=None):
    conns = conns or FakeConnections()
    return conns, StockInteractor(contents, locks or FakeLocks(), conns, Rolls(roll), board or FakeStaffBoard()).refill(StockCommand(now=now))


# 메시지가 올 때 때가 된 기계만 채운다: 저장은 한 번, 바뀐 기계와 다음 채울 시각을 모두에게 (설계 2026-10-31 인형 채우기 §4.1)
async def test_due_refill_fills_saves_once_and_tells_everyone():
    contents = FakeContents(stocks_with_empty("A-1", next_at=30.0), due=30.0)
    conns, job = run(contents, 31.0)
    await job
    kinds = [m["t"] for _, m in conns.broadcasts]
    assert contents.saves == 1 and len(contents.stored["A-1"].dolls) == 9
    assert kinds == ["machine", "stock"] and conns.broadcasts[-1][1]["in"] is None  # 모두 가득 → 다음 채울 시각 없음


async def test_nothing_is_read_before_the_due_time():
    contents = FakeContents(stocks_with_empty("A-1", next_at=30.0), due=30.0)
    conns, job = run(contents, 10.0)
    await job
    assert contents.loads == 0 and conns.broadcasts == []


async def test_a_gold_refill_is_announced():
    contents = FakeContents(stocks_with_empty("A-1", next_at=30.0), due=30.0)
    conns, job = run(contents, 31.0, roll=0.001)  # 황금 굴림
    await job
    assert ("spawn", "A-1", "gold") in [(m["t"], m.get("m"), m.get("rv")) for _, m in conns.broadcasts]


async def test_a_locked_machine_is_not_refilled_and_waits_a_full_slot():
    locks = FakeLocks()
    locks.lock("c-1", "A-1", 20.0)
    contents = FakeContents(stocks_with_empty("A-1", next_at=30.0), due=30.0)
    conns, job = run(contents, 31.0, locks=locks)
    await job
    assert len(contents.stored["A-1"].dolls) == 8 and contents.stored["A-1"].next_at == 61.0
    assert [m["t"] for _, m in conns.broadcasts] == ["stock"] and conns.broadcasts[0][1]["in"] == 30.0


# Review Focus 2: 시간이 지난 잠금(판 사이 20초 끝)은 채우기를 막지 않는다 — 잠금은 다음 메시지가 와야 풀린다
async def test_a_stale_lock_does_not_block_refill():
    locks = FakeLocks()
    locks.hold("c-1", "A-1", 0.0)
    contents = FakeContents(stocks_with_empty("A-1", next_at=30.0), due=30.0)
    _, job = run(contents, 31.0, locks=locks)
    await job
    assert len(contents.stored["A-1"].dolls) == 9


async def test_a_newcomer_hears_when_the_next_refill_is():
    contents = FakeContents(stocks_with_empty("A-1", next_at=50.0), due=50.0)
    conns = FakeConnections()
    await StockInteractor(contents, FakeLocks(), conns, Rolls(0.5), FakeStaffBoard()).refill(StockCommand(now=20.0, newcomer="c-9"))
    assert conns.direct == [("c-9", {"t": "stock", "in": 30.0})] and contents.loads == 0


# 설계 ring-hook §4: 미는 뽑기 기계도 같은 채우기 시계로 — 빈 자리엔 24종 중 아무 미니 인형이 칸 위에서
async def test_a_due_pusher_refills_with_mixed_dolls():
    import random

    from toycrane.domain.pusher_crane import FULL, generate_mixed_stock
    from toycrane.domain.stock import MachineStock

    stocks = stocks_with_empty("A-1", next_at=30.0)
    full = generate_mixed_stock(random.Random(4))
    stocks["P-3"] = MachineStock(full.dolls[2:], 30.0, full.next_uid)
    contents = FakeContents(stocks, due=30.0)
    conns, job = run(contents, 61.0)
    await job
    assert len(contents.stored["P-3"].dolls) == FULL and len(contents.stored["A-1"].dolls) == 9 and contents.saves == 1
    assert [m.get("m") for _, m in conns.broadcasts if m["t"] == "machine"] == ["A-1", "P-3"]


# 상주 직원(설계 2026-11-24 store-staff): 직원 일이 잡힌 기계는 다시 놓기 전까지 잠금이 없어도 새 인형을 채우지 않는다(다시 놓은 배치가 그대로 그려지게)
async def test_refill_waits_for_a_pending_staff_job():
    from toycrane.domain.staff import EMPTY_BOARD, plan_call

    called, job = plan_call(EMPTY_BOARD, "A-1", "g-1", 29.0)
    contents = FakeContents(stocks_with_empty("A-1", next_at=30.0), due=30.0)
    conns, run_ = run(contents, 31.0, board=FakeStaffBoard(called))
    assert job.put > 31.0
    await run_
    assert len(contents.stored["A-1"].dolls) == 8 and [m["t"] for _, m in conns.broadcasts] == ["stock"]

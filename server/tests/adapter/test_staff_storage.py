from fakes import FakeStorage
from toycrane.adapter.outbound.do_storage_staff_board import DoStorageStaffBoard
from toycrane.domain.staff import EMPTY_BOARD, count_play, plan_call


# 상주 직원 일정·부른 판 수는 DO 저장소에 남는다(잠들었다 깨도 같은 일정)
async def test_staff_board_round_trips():
    store = DoStorageStaffBoard(FakeStorage())
    assert await store.load() == EMPTY_BOARD
    board, _ = plan_call(EMPTY_BOARD, "A-1", "g-1", 100.0)
    board, _ = plan_call(board, "A-5", "g-2", 100.5)
    board = count_play(board, "A-1", "g-1")
    await store.save(board)
    assert await store.load() == board

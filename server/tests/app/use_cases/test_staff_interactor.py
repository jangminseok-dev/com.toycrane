import random
from dataclasses import replace

from fakes import FakeConnections, FakeContents, FakeFigureBoxes, FakeLocks, FakeRegistry, FakeStaffBoard, player
from toycrane.adapter.inbound.ws.schemas.server_messages import staff_no, staff_plan
from toycrane.app.dtos.staff_dto import StaffCommand
from toycrane.app.use_cases.staff_interactor import StaffInteractor
from toycrane.domain.crane import DROP_HALF
from toycrane.domain.figure import FIGURE_RULES, FigureState
from toycrane.domain.hook import HOOK_RULES
from toycrane.domain.layout import MACHINE_IDS, MACHINES, PUSHERS
from toycrane.domain.play_rules import HOLD_SECONDS
from toycrane.domain.pusher_crane import generate_mixed_stock
from toycrane.domain.shared_data import STAFF
from toycrane.domain.staff import EMPTY_BOARD, back_at, count_play, plan_call
from toycrane.domain.stock import generate_stock


def setup():
    stored = {m: generate_stock(MACHINES[m].kind, random.Random(9)) for m in MACHINE_IDS}
    stored.update({p: generate_mixed_stock(random.Random(9)) for p in PUSHERS})
    stored = {m: replace(s, dolls=[replace(d, y=0.87) for d in s.dolls]) for m, s in stored.items()}  # 앉은 인형
    reg, locks, conns, contents = FakeRegistry(), FakeLocks(), FakeConnections(), FakeContents(stored)
    figures = FakeFigureBoxes({m: FigureState(FIGURE_RULES.start_box(random.Random(1), m), 3) for m in FIGURE_RULES.machines})
    hooks = FakeFigureBoxes({m: FigureState(HOOK_RULES.start_box(random.Random(1), m), 2) for m in HOOK_RULES.machines})
    board = FakeStaffBoard()
    reg.put("c-1", player("p1", guest="g-1"))
    it = StaffInteractor(reg, locks, contents, figures, hooks, board, conns, random.Random(4))
    return locks, conns, contents, figures, hooks, board, it


# 상주 직원(설계 2026-11-24 store-staff): 판 사이 자리를 잡은 손님이 부르면 일정을 정해 저장하고, 기계 안을 전부 다시 놓아 저장하고,
# 모두에게 일정과 결과를 한 번에 알린다. 부른 손님의 판 사이 자리는 다시 놓기(put) 뒤 20초까지
async def test_staff_call_plans_a_job_redrops_and_tells_everyone():
    locks, conns, contents, figures, hooks, board, it = setup()
    locks.hold("c-1", "A-1", 10.0)
    await it.call(StaffCommand("c-1", "A-1", now=15.0))
    after = contents.stored["A-1"]
    assert all(d.y is None and abs(d.x) <= DROP_HALF[0] for d in after.dolls) and contents.saves == 1
    (job,) = board.board.jobs["doll"]
    assert job.machine == "A-1" and job.depart == 15.0 and board.board.calls == {"A-1": {"g-1": 0}}
    assert conns.broadcasts == [(None, staff_plan("doll", board.board.jobs["doll"], back_at(board.board.jobs["doll"], "doll"), 15.0, "A-1", after.dolls, None))]
    assert locks.lock_of("c-1") == ("A-1", job.put) and locks.is_between("c-1") and conns.direct == []


async def test_staff_call_on_a_pusher_keeps_ledge_dolls_on_the_ledge():
    locks, conns, contents, figures, hooks, board, it = setup()
    locks.hold("c-1", "P-1", 10.0)
    await it.call(StaffCommand("c-1", "P-1", now=15.0))
    after = contents.stored["P-1"]
    assert all(d.y is None for d in after.dolls) and board.board.jobs["pusher"][0].machine == "P-1"
    assert conns.broadcasts[0][1]["t"] == "staff_plan" and conns.broadcasts[0][1]["dolls"] and "box" not in conns.broadcasts[0][1]


async def test_staff_call_on_a_figure_and_a_hook_puts_the_box_back_to_start():
    for machine, store, rules, zone in (("F-1", "figures", FIGURE_RULES, "figure"), ("R-1", "hooks", HOOK_RULES, "hook")):
        locks, conns, contents, figures, hooks, board, it = setup()
        boxes = figures if store == "figures" else hooks
        locks.hold("c-1", machine, 10.0)
        await it.call(StaffCommand("c-1", machine, now=15.0))
        state = boxes.stored[machine]
        assert state.still == 0 and boxes.saves == 1 and contents.saves == 0
        msg = conns.broadcasts[0][1]
        assert msg["z"] == zone and msg["box"] == [round(v, 3) for v in state.box] and "dolls" not in msg


async def test_staff_call_refused_tells_why():
    locks, conns, contents, figures, hooks, board, it = setup()
    # 자리 없음, 한 판 도중, 자리 시간 지남 → seat
    for prep in (lambda: None, lambda: locks.lock("c-1", "A-1", 10.0), lambda: locks.hold("c-1", "A-1", 10.0)):
        locks.release("c-1"); conns.direct.clear(); prep()
        await it.call(StaffCommand("c-1", "A-1", now=10.0 + HOLD_SECONDS + 1))
        assert conns.direct == [("c-1", staff_no("A-1", "seat", 0))]
    # 부른 뒤 5판이 안 됨 → wait(남은 판)
    called, _ = plan_call(EMPTY_BOARD, "A-1", "g-1", 0.0)
    board.board = count_play(replace(called, jobs={}), "A-1", "g-1")
    locks.hold("c-1", "A-1", 100.0); conns.direct.clear()
    await it.call(StaffCommand("c-1", "A-1", now=101.0))
    assert conns.direct == [("c-1", staff_no("A-1", "wait", STAFF["calls_every"] - 1))]
    assert conns.broadcasts == [] and contents.saves == 0


async def test_a_busy_zone_refuses_and_does_not_count():
    locks, conns, contents, figures, hooks, board, it = setup()
    b = EMPTY_BOARD
    for i, m in enumerate(["A-2", "A-3", "A-4"]):
        b, _ = plan_call(b, m, f"other-{i}", 100.0)
    board.board = b
    locks.hold("c-1", "A-1", 100.0)
    await it.call(StaffCommand("c-1", "A-1", now=100.5))
    assert conns.direct == [("c-1", staff_no("A-1", "busy", 0))] and "A-1" not in board.board.calls

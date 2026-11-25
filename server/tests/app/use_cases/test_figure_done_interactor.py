"""9단계 피규어 뽑기 판 보고(설계 §4): 잠근 사람의 상자 자리 보고를 상식만 확인해 저장하고, 막대 사이로 빠졌으면 그 순간 경품을 정해 가방에."""

import json
import random

from fakes import FakeBag, FakeConnections, FakeFigureBoxes, FakeLocks, FakeRegistry, player
from toycrane.adapter.inbound.ws.schemas.server_messages import done_no, figure, result
from toycrane.app.dtos.done_dto import DoneCommand
from toycrane.app.use_cases.figure_done_interactor import FigureDoneInteractor
from toycrane.domain.catalog import DOLLS
from toycrane.domain.figure import FigureState, start_box
from toycrane.domain.layout import FIGURES
from toycrane.domain.report import DollPose, Report
from toycrane.domain.shared_data import FIGURE

BARS, BOX, SQUARE = FIGURE["bars"], FIGURE["variants"]["long"]["box"], FIGURE["variants"]["square"]["box"]  # F-1 긴 상자, F-8 정사각형
FELL = (0.01, BARS["y"] - BOX["h"] - 0.05, 0.0, 0.0, 0.0, 0.0, 1.0)


def setup(rng=None):
    reg, conns, bag = FakeRegistry(), FakeConnections(), FakeBag()
    locks = FakeLocks({"c-1": "p1", "c-2": "p2"})
    reg.put("c-1", player("p1", guest="g-1"))
    reg.put("c-2", player("p2", guest="g-2"))
    boxes = FakeFigureBoxes({m: FigureState(start_box(random.Random(i), f.box), 0) for i, (m, f) in enumerate(FIGURES.items())})
    locks.lock("c-1", "F-1", 10.0)
    return locks, conns, bag, boxes, FigureDoneInteractor(reg, locks, boxes, bag, conns, rng=rng or random.Random(5))


def report(box, won=False):
    return Report((0,) if won else (), (DollPose(0, *box[:3], tuple(box[3:])),))


def moved(box, dz):
    return (box[0], box[1], box[2] + dz, *box[3:])


async def test_figure_win_rolls_prize_into_bag_zone_figure():
    locks, conns, bag, boxes, it = setup()
    await it.done(DoneCommand("c-1", "F-1", report(FELL, won=True), now=20.0))
    assert len(bag.added) == 1
    guest, kind, color, rare, zone = bag.added[0]
    assert (guest, color, zone) == ("g-1", 0, "figure") and kind in DOLLS
    assert conns.direct == [("c-1", {"t": "bag", "n": 1, "new": [[kind, 0, rare]]})]  # 처음 생긴 칸(당첨 카드 NEW)
    new_box = boxes.stored["F-1"].box
    assert boxes.stored["F-1"].still == 0 and abs(new_box[1] - (BARS["y"] + BARS["radius"] + BOX["d"] / 2)) < 1e-9
    assert conns.broadcasts == [(None, result("F-1", "p1", [(kind, 0, rare, 0)])), (None, figure("F-1", new_box, False))]
    assert locks.is_between("c-1")  # 이어서 할 자리는 남는다


async def test_figure_miss_saves_reported_box():
    locks, conns, bag, boxes, it = setup()
    after = moved(boxes.stored["F-1"].box, -0.02)
    await it.done(DoneCommand("c-1", "F-1", report(after), now=20.0))
    assert bag.added == [] and boxes.saves == 1
    assert boxes.stored["F-1"].box == after
    assert conns.broadcasts == [(None, result("F-1", "p1", [])), (None, figure("F-1", after, False))]


async def test_expired_lock_keeps_box():
    locks, conns, bag, boxes, it = setup()
    before = boxes.stored["F-1"]
    await it.done(DoneCommand("c-1", "F-1", report(FELL, won=True), now=10.0 + 60))
    assert boxes.saves == 0 and boxes.stored["F-1"] == before and bag.added == []
    assert (None, {"t": "free", "m": "F-1"}) in conns.broadcasts


async def test_bad_report_keeps_box():
    locks, conns, bag, boxes, it = setup()
    before = boxes.stored["F-1"]
    await it.done(DoneCommand("c-1", "F-1", report(before.box, won=True), now=20.0))  # 막대 위인데 빠졌다고
    assert conns.direct == [("c-1", done_no("F-1", "won"))]
    assert boxes.saves == 0 and boxes.stored["F-1"] == before and bag.added == []
    locks2, conns2, bag2, boxes2, it2 = setup()
    await it2.done(DoneCommand("c-1", "F-1", Report((), ()), now=20.0))  # 상자 줄이 없음
    assert conns2.direct == [("c-1", done_no("F-1", "count"))] and boxes2.saves == 0


async def test_prize_is_decided_only_at_win():
    locks, conns, bag, boxes, it = setup()
    await it.done(DoneCommand("c-1", "F-1", report(moved(boxes.stored["F-1"].box, 0.01)), now=20.0))
    said = json.dumps([m for _, m in conns.broadcasts + conns.direct], ensure_ascii=False)
    assert not any(k in said for k in DOLLS) and bag.added == []


async def test_square_machine_gets_a_square_box_after_a_win():
    """정사각형 기계(F-8)에서 빠지면 그 기계에는 정사각형 새 상자가 놓인다 — 당첨 기준도 그 상자 길이로 (설계 §8)."""
    locks, conns, bag, boxes, it = setup()
    locks.lock("c-2", "F-8", 10.0)
    fell = (0.0, BARS["y"] - SQUARE["h"] - 0.05, 0.0, 0.0, 0.0, 0.0, 1.0)
    await it.done(DoneCommand("c-2", "F-8", report(fell, won=True), now=20.0))
    new_box = boxes.stored["F-8"].box
    assert abs(new_box[1] - (BARS["y"] + BARS["radius"] + SQUARE["d"] / 2)) < 1e-9


# 상자 기계 일반화(계획 12 Task 4): 판 보고는 기계 종류의 규칙(BoxRules)과 가방 구역을 따른다 — 고리 걸기도 같은 길
async def test_box_done_uses_the_given_rules_and_zone():
    from toycrane.domain.box_rules import BoxRules
    from toycrane.domain.figure import FIGURE_RULES

    calls = []
    rules = BoxRules(
        machines=("F-1",), zone="ring",
        start_box=lambda rng, m: FIGURE_RULES.start_box(rng, m),
        check_report=lambda box, won, m: (calls.append(("check", m)), FIGURE_RULES.check_report(box, won, m))[1],
        after_play=lambda state, box, won, rng, m: (calls.append(("after", m)), FIGURE_RULES.after_play(state, box, won, rng, m))[1],
    )
    locks, conns, bag, boxes, _ = setup()
    reg = FakeRegistry()
    reg.put("c-1", player("p1", guest="g-1"))
    it = FigureDoneInteractor(reg, locks, boxes, bag, conns, rules=rules, rng=random.Random(5))
    await it.done(DoneCommand("c-1", "F-1", report(FELL, won=True), now=20.0))
    assert calls == [("check", "F-1"), ("after", "F-1")]
    assert bag.added[0][4] == "ring"


# 고리 걸기(계획 12 Task 7): 같은 판 보고 길, 규칙은 HOOK_RULES — 출구로 빠지면 피규어 경품이 가방 구역 'ring'으로, 선반 위인데 당첨이면 거절
async def test_hook_done_wins_into_zone_ring_and_refuses_a_shelf_win():
    from toycrane.domain.hook import HOOK_RULES, start_box as hook_start
    from toycrane.domain.shared_data import HOOK

    reg, conns, bag = FakeRegistry(), FakeConnections(), FakeBag()
    locks = FakeLocks({"c-1": "p1"})
    reg.put("c-1", player("p1", guest="g-1"))
    hooks = FakeFigureBoxes({"R-1": FigureState(hook_start(random.Random(1), "R-1"), 0)})
    it = FigureDoneInteractor(reg, locks, hooks, bag, conns, rules=HOOK_RULES, rng=random.Random(5))
    on_shelf = (0.0, HOOK["shelf"]["y"] + HOOK["box"]["h"] / 2, -0.1, 0.0, 0.0, 0.0, 1.0)
    locks.lock("c-1", "R-1", 10.0)
    await it.done(DoneCommand("c-1", "R-1", report(on_shelf, won=True), now=20.0))
    assert bag.added == [] and conns.direct[-1][1]["t"] == "done_no"
    locks.lock("c-1", "R-1", 30.0)
    fell = (0.0, HOOK["shelf"]["y"] - HOOK["box"]["h"], 0.3, 0.0, 0.0, 0.0, 1.0)
    await it.done(DoneCommand("c-1", "R-1", report(fell, won=True), now=40.0))
    assert len(bag.added) == 1 and bag.added[0][4] == "ring"

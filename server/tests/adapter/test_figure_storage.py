"""9단계 피규어 뽑기: 기계마다 상자 하나의 자리를 DO 저장소 figures_v1에 둔다 — 경품은 뽑힌 순간 정하므로 저장에 없다."""

import json
import random

from fakes import FakeStorage
from toycrane.adapter.inbound.ws.schemas.server_messages import welcome
from toycrane.adapter.outbound.do_storage_figure_boxes import KEY, DoStorageFigureBoxes
from toycrane.app.dtos.player_view import PlayerView
from toycrane.app.dtos.store_snapshot import StoreSnapshot
from toycrane.app.use_cases.figure_boxes import ensure_figures
from toycrane.domain.layout import FIGURES


def _numbers_only(v) -> bool:
    if isinstance(v, dict):
        return all(isinstance(k, str) and _numbers_only(x) for k, x in v.items())
    if isinstance(v, list):
        return all(_numbers_only(x) for x in v)
    return isinstance(v, (int, float)) and not isinstance(v, bool)


async def test_figure_state_carries_no_prize():
    storage = FakeStorage()
    port = DoStorageFigureBoxes(storage)
    states = await ensure_figures(port, random.Random(1))
    assert set(states) == set(FIGURES)
    raw = json.loads(storage.data[KEY])
    assert set(raw) == set(FIGURES)
    for v in raw.values():
        assert set(v) == {"b", "s"} and len(v["b"]) == 7 and _numbers_only(v)
    assert await port.load() == states  # 다시 읽어도 같은 상자
    you = PlayerView("p1", "토끼", 3, 0.0, 0.0, 0, 0, None)
    snap = StoreSnapshot(coins=0, bag=0, machines={}, plays={}, figures={m: s.box for m, s in states.items()})
    msg = welcome(1, you, [], snap)
    assert set(msg["figures"]) == set(FIGURES) and _numbers_only(msg["figures"])
    assert all(len(b) == 7 for b in msg["figures"].values())


async def test_existing_boxes_are_kept():
    storage = FakeStorage()
    port = DoStorageFigureBoxes(storage)
    first = await ensure_figures(port, random.Random(1))
    again = await ensure_figures(port, random.Random(2))
    assert again == first


async def test_old_small_boxes_are_not_read():
    """옛 작은 상자(figures_v1)는 읽지 않는다 — 14대 모두 종류에 맞는 새 큰 상자(누운 높이)를 받는다 (설계 §8.4)."""
    from toycrane.domain.shared_data import FIGURE

    storage = FakeStorage()
    storage.data["figures_v1"] = json.dumps({m: {"b": [0, 1.032, 0, 0, 0, 0, 1], "s": 3} for m in FIGURES})
    states = await ensure_figures(DoStorageFigureBoxes(storage), random.Random(1))
    assert KEY == "figures_v2" and set(states) == set(FIGURES)
    bars = FIGURE["bars"]
    for m, s in states.items():
        d = FIGURE["variants"][FIGURES[m].box]["box"]["d"]
        assert abs(s.box[1] - (bars["y"] + bars["radius"] + d / 2)) < 1e-9 and s.still == 0

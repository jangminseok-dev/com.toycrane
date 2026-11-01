"""act 메시지 읽기(설계 2026-11-02 §8): 고리·미는 뽑기 기계에만, 숫자 좌표만."""

from toycrane.adapter.inbound.ws.schemas.act_schema import parse


def test_act_parses_ring_and_pusher_machines_only():
    assert parse({"t": "act", "m": "R-1", "x": -0.1, "y": 1.45}) == ("R-1", -0.1, 1.45)
    assert parse({"t": "act", "m": "P-2", "x": 0.2, "y": 0}) == ("P-2", 0.2, 0.0)
    assert parse({"t": "act", "m": "C-6", "x": 0, "y": 0}) is None  # 인형 기계
    assert parse({"t": "act", "m": "F-1", "x": 0, "y": 0}) is None  # 피규어 기계
    assert parse({"t": "act", "m": "R-1", "x": "0", "y": 0}) is None
    assert parse({"t": "act", "m": "R-1", "x": True, "y": 0}) is None
    assert parse({"t": "act", "m": "R-1", "x": 0}) is None

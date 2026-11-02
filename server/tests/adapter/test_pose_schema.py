import json
from pathlib import Path

import pytest

from toycrane.adapter.inbound.ws.schemas.pose_schema import MAX_FRAMES, parse

FX = json.loads((Path(__file__).resolve().parents[3] / "shared" / "protocol_fixtures.json").read_text(encoding="utf-8"))
C = [0.1, 1.6, 0.2, 0.4]


def one(m: str, d: list, age: float = 0) -> dict:
    return {"t": "pose", "m": m, "f": [[age, C, d]]}


def test_pose_takes_a_figure_machine():
    assert parse(one("F-2", [[0, 0.01, 1.03, 0.02, 0, 0, 0, 1]]))[0] == "F-2"


# 0.4초 묶음(2026-11-02, 무료 한도): 자리마다 [나이, 집게, 인형들] — 나이는 가장 새것이 0
def test_pose_fixture_parses():
    assert parse(FX["client_pose"]) == ("A-3", ((0.1, (0.1, 1.6, 0.2, 0.4), ((7, 0.2, 1.3, 0.1, 0, 0, 0, 1),)), (0.0, (0.1, 1.5, 0.2, 0.4), ())))


def test_pose_rounds_to_two_decimals():
    data = {"t": "pose", "m": "A-1", "f": [[0.333, [0.123, 1.6, 0.2, 0.44], [[3, 0.129, 1.301, 0, 0, 0.70711, 0, 0.70711]]]]}
    assert parse(data) == ("A-1", ((0.33, (0.12, 1.6, 0.2, 0.44), ((3, 0.13, 1.3, 0, 0, 0.71, 0, 0.71),)),))


@pytest.mark.parametrize("bad", [
    one("Z-9", []),
    {"t": "pose", "m": "A-1", "f": [[0, [0, 0, 0], []]]},
    {"t": "pose", "m": "A-1", "f": [[0, [0, 0, 0, "a"], []]]},
    one("A-1", [[3, 0, 0, 0, 0, 0, 0, 1]] * 10),
    one("A-1", [[3, 0, 0, 0, 0, 0, 0]]),
    {"t": "pose", "m": "A-1"},
    {"t": "pose", "m": "A-1", "f": []},
    {"t": "pose", "m": "A-1", "f": [[0, C, []]] * (MAX_FRAMES + 1)},
    one("A-1", [], age=-0.1),
    one("A-1", [], age=9),
    {"t": "pose", "m": "A-1", "c": C, "d": []},  # 옛 형식(규약 14)
])
def test_pose_rejects_bad_messages(bad):
    assert parse(bad) is None


# 미는 뽑기: 판이 미는 동안 여러 미니 인형이 함께 움직인다 — 기계 종류별 상한(cap)까지 중계
def test_pose_relays_many_moving_mini_dolls():
    moving = [[u, 0.1, 0.95, 0, 0, 0, 0, 1] for u in range(1, 21)]
    assert len(parse(one("P-2", moving))[1][0][2]) == 20
    assert parse(one("A-1", moving)) is None

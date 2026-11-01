import json
from pathlib import Path

import pytest

from toycrane.adapter.inbound.ws.schemas.pose_schema import parse

FX = json.loads((Path(__file__).resolve().parents[3] / "shared" / "protocol_fixtures.json").read_text(encoding="utf-8"))


def test_pose_takes_a_figure_machine():
    msg = {"t": "pose", "m": "F-2", "c": [0.1, 1.6, 0.2, 0.4], "d": [[0, 0.01, 1.03, 0.02, 0, 0, 0, 1]]}
    assert parse(msg)[0] == "F-2"


def test_pose_fixture_parses():
    assert parse(FX["client_pose"]) == ("A-3", (0.1, 1.6, 0.2, 0.4), ((7, 0.2, 1.3, 0.1, 0, 0, 0, 1),))


def test_pose_rounds_to_two_decimals():
    data = {"t": "pose", "m": "A-1", "c": [0.123, 1.6, 0.2, 0.44], "d": [[3, 0.129, 1.301, 0, 0, 0.70711, 0, 0.70711]]}
    assert parse(data) == ("A-1", (0.12, 1.6, 0.2, 0.44), ((3, 0.13, 1.3, 0, 0, 0.71, 0, 0.71),))


@pytest.mark.parametrize("bad", [
    {"t": "pose", "m": "Z-9", "c": [0, 0, 0, 0], "d": []},
    {"t": "pose", "m": "A-1", "c": [0, 0, 0], "d": []},
    {"t": "pose", "m": "A-1", "c": [0, 0, 0, "a"], "d": []},
    {"t": "pose", "m": "A-1", "c": [0, 0, 0, 0], "d": [[3, 0, 0, 0, 0, 0, 0, 1]] * 10},
    {"t": "pose", "m": "A-1", "c": [0, 0, 0, 0], "d": [[3, 0, 0, 0, 0, 0, 0]]},
    {"t": "pose", "m": "A-1", "c": [0, 0, 0, 0]},
])
def test_pose_rejects_bad_messages(bad):
    assert parse(bad) is None

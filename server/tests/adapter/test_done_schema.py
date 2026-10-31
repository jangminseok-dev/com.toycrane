import json
from pathlib import Path

import pytest

from toycrane.adapter.inbound.ws.schemas.done_schema import parse
from toycrane.domain.report import DollPose, Report

FX = json.loads((Path(__file__).resolve().parents[3] / "shared" / "protocol_fixtures.json").read_text(encoding="utf-8"))


def test_done_fixture_parses():
    assert parse(FX["client_done"]) == ("A-3", Report((7,), (DollPose(8, 0.2, 0.87, 0.1, (0, 0, 0, 1)),)))


def test_done_rounds_to_three_decimals_and_allows_no_wins():
    data = {"t": "done", "m": "A-1", "won": [], "dolls": [[3, 0.12345, 0.87001, -0.05, 0, 0.70711, 0, 0.70711]]}
    assert parse(data) == ("A-1", Report((), (DollPose(3, 0.123, 0.87, -0.05, (0, 0.707, 0, 0.707)),)))


@pytest.mark.parametrize("bad", [
    {"t": "done", "m": "Z-9", "won": [], "dolls": []},
    {"t": "done", "m": "A-1", "won": list(range(10)), "dolls": []},
    {"t": "done", "m": "A-1", "won": ["7"], "dolls": []},
    {"t": "done", "m": "A-1", "won": [], "dolls": [[3, 0.1, 0.87]]},
    {"t": "done", "m": "A-1", "won": [], "dolls": [[3, float("inf"), 0.87, 0, 0, 0, 0, 1]]},
    {"t": "done", "m": "A-1", "won": [], "dolls": [[3, True, 0.87, 0, 0, 0, 0, 1]]},
    {"t": "done", "m": "A-1", "won": [], "dolls": [[3, 0, 0.87, 0, 0, 0, 0, 1]] * 10},
    {"t": "done", "m": "A-1", "won": []},
])
def test_done_rejects_bad_reports(bad):
    assert parse(bad) is None


# 최종 리뷰 I2: 당첨 4개는 스키마가 아니라 도메인(check_report)이 "wins"로 거절해 done_no가 가게 — 9개까지 읽는다
def test_up_to_nine_wins_are_parsed():
    data = {"t": "done", "m": "A-1", "won": [1, 2, 3, 4], "dolls": []}
    assert parse(data) == ("A-1", Report((1, 2, 3, 4), ()))
    assert parse({"t": "done", "m": "A-1", "won": list(range(10)), "dolls": []}) is None

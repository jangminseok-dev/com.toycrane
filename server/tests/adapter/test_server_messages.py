import json
from pathlib import Path

from toycrane.adapter.inbound.ws.schemas.server_messages import (
    bag, coins, correct, free, join, leave, machine, move, play, play_no, play_ok, queue, queue_no, result, welcome,
)
from toycrane.app.dtos.drop_dto import ResultView
from toycrane.app.dtos.player_view import PlayerView
from toycrane.app.dtos.store_snapshot import StoreSnapshot
from toycrane.domain.crane import DollSpot

FX = json.loads((Path(__file__).resolve().parents[3] / "shared" / "protocol_fixtures.json").read_text(encoding="utf-8"))


def view(d: dict) -> PlayerView:
    return PlayerView(**d)


def test_welcome_matches_fixture():
    fx = FX["server_welcome"]
    snap = StoreSnapshot(
        coins=5, bag=2,
        machines={"A-1": [DollSpot("bunny", 0.1204, -0.0501, 1.5703), DollSpot("starbunny", -0.2, 0.1, 3.1, 0.21)]},
        queues=[["p2"], []], plays={"A-3": "p2"},
    )
    assert welcome(fx["store"], view(fx["you"]), [view(p) for p in fx["players"]], snap) == fx


def test_join_matches_fixture():
    assert join(view(FX["server_join"]["p"])) == FX["server_join"]


def test_move_matches_fixture():
    fx = FX["server_move"]
    assert move(PlayerView(fx["id"], "곰돌이", 5, fx["x"], fx["z"], fx["dx"], fx["dz"])) == fx


def test_correct_and_leave_match_fixtures():
    assert correct(1.6, 3.0) == FX["server_correct"]
    assert leave("p2") == FX["server_leave"]


def test_positions_are_rounded_for_the_wire():
    assert move(PlayerView("p2", "곰돌이", 5, 1.60004, 2.99996, 0.70712, -0.70712)) == {
        "t": "move", "id": "p2", "x": 1.6, "z": 3.0, "dx": 0.707, "dz": -0.707,
    }


def test_queue_and_coin_messages_match_fixtures():
    assert queue(0, ["p1", "p2"]) == FX["server_queue"]
    assert queue_no(0, "full") == FX["server_queue_no"]
    assert coins(10, 5) == FX["server_coins"]


def test_play_messages_match_fixtures():
    assert play_ok("A-3", 9, 20) == FX["server_play_ok"]
    assert play_no("A-3", "busy") == FX["server_play_no"]
    assert play("A-3", "p1") == FX["server_play"]
    assert result(ResultView("A-3", "p1", 0.1204, -0.0501, "win", "head", "bunny")) == FX["server_result"]
    assert machine("A-3", [DollSpot("bear", 0.2, 0.1, 0.5)]) == FX["server_machine"]
    assert free("A-3") == FX["server_free"] and bag(3) == FX["server_bag"]

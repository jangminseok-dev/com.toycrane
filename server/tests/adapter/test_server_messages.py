import json
from pathlib import Path

from toycrane.adapter.inbound.ws.schemas.server_messages import correct, join, leave, move, welcome
from toycrane.app.dtos.player_view import PlayerView

FX = json.loads((Path(__file__).resolve().parents[3] / "shared" / "protocol_fixtures.json").read_text(encoding="utf-8"))


def view(d: dict) -> PlayerView:
    return PlayerView(**d)


def test_welcome_matches_fixture():
    fx = FX["server_welcome"]
    assert welcome(fx["store"], view(fx["you"]), [view(p) for p in fx["players"]]) == fx


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

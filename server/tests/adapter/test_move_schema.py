import json
from pathlib import Path

import pytest

from toycrane.adapter.inbound.ws.schemas.move_schema import parse
from toycrane.app.dtos.move_dto import MoveCommand

FX = json.loads((Path(__file__).resolve().parents[3] / "shared" / "protocol_fixtures.json").read_text(encoding="utf-8"))


def test_client_move_fixture_parses():
    cmd = parse(FX["client_move"], "c-1", now=5.0)
    assert (cmd.conn_id, cmd.x, cmd.z, cmd.now) == ("c-1", 1.5, -2.0, 5.0)
    assert cmd.dx == pytest.approx(0.7071068) and cmd.dz == pytest.approx(-0.7071068)


def test_heading_is_normalized_and_stop_stays_zero():
    assert parse({"t": "move", "x": 0, "z": 0, "dx": 0.3, "dz": 0.4}, "c-1", 0.0) == MoveCommand("c-1", 0, 0, 0.6, 0.8, 0.0)
    assert parse({"t": "move", "x": 0, "z": 0, "dx": 0, "dz": 0}, "c-1", 0.0) == MoveCommand("c-1", 0, 0, 0.0, 0.0, 0.0)


@pytest.mark.parametrize("bad", [m for m in FX["bad_client_moves"] if isinstance(m, dict)] + [{"t": "move", "x": True, "z": 0, "dx": 0, "dz": 0}])
def test_bad_moves_are_rejected(bad):
    assert parse(bad, "c-1", 0.0) is None

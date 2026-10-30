"""화면→서버 move 메시지 검증. 견본: shared/protocol_fixtures.json (client_move, bad_client_moves)."""

import math

from toycrane.app.dtos.move_dto import MoveCommand


def _number(value) -> float | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    return float(value) if math.isfinite(value) else None


def parse(data: dict, conn_id: str, now: float) -> MoveCommand | None:
    if data.get("t") != "move":
        return None
    x, z, dx, dz = (_number(data.get(k)) for k in ("x", "z", "dx", "dz"))
    if None in (x, z, dx, dz) or abs(dx) > 1 or abs(dz) > 1:
        return None
    length = math.hypot(dx, dz)
    if length > 1e-6:
        dx, dz = dx / length, dz / length
    else:
        dx, dz = 0.0, 0.0
    return MoveCommand(conn_id, x, z, dx, dz, now)

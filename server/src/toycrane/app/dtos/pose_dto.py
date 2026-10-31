from dataclasses import dataclass


@dataclass(frozen=True)
class PoseCommand:
    """판을 하는 사람의 집게(x, y, z, 벌림)와 움직이는 인형들([번호, x, y, z, qx, qy, qz, qw])."""

    conn_id: str
    machine_id: str
    claw: tuple[float, float, float, float]
    dolls: tuple[tuple[float, ...], ...]
    now: float

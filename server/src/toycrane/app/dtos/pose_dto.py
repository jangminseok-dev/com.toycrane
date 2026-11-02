from dataclasses import dataclass

Frame = tuple[float, tuple[float, float, float, float], tuple[tuple[float, ...], ...]]


@dataclass(frozen=True)
class PoseCommand:
    """판을 하는 사람의 0.4초 묶음: 자리마다 (나이(초, 가장 새것이 0), 집게 (x, y, z, 벌림), 움직이는 인형들 ([번호, x, y, z, qx, qy, qz, qw], …))."""

    conn_id: str
    machine_id: str
    frames: tuple[Frame, ...]
    now: float

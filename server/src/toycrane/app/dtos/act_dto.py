from dataclasses import dataclass


@dataclass(frozen=True)
class ActCommand:
    """고리·미는 뽑기 한 판(설계 2026-11-02 §8): 화면이 멈춘 자리만 보낸다 — 고리는 갈고리 끝 (x, y), 미는 뽑기는 미는 판 x(y는 0)."""

    conn_id: str
    machine_id: str
    x: float
    y: float
    now: float

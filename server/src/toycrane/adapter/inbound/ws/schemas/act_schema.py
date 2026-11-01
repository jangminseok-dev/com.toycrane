"""화면→서버 act 메시지 검증(설계 2026-11-02 §8): 고리·미는 뽑기 기계, 유한 숫자 x·y (미는 뽑기는 y를 쓰지 않는다)."""

import math

from toycrane.domain.layout import PUSHERS, RINGS


def _number(value) -> float | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    return float(value) if math.isfinite(value) else None


def parse(data: dict) -> tuple[str, float, float] | None:
    m = data.get("m")
    if not isinstance(m, str) or (m not in RINGS and m not in PUSHERS):
        return None
    x, y = _number(data.get("x")), _number(data.get("y"))
    return None if x is None or y is None else (m, x, y)

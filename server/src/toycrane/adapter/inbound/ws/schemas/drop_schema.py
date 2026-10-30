"""화면→서버 drop 메시지 검증: 유한한 숫자 좌표만(소수 3자리). 놀이 영역 밖이면 판정에서 안으로 자른다."""

import math


def _number(value) -> float | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    return float(value) if math.isfinite(value) else None


def parse(data: dict) -> tuple[float, float] | None:
    x, z = _number(data.get("x")), _number(data.get("z"))
    return None if x is None or z is None else (round(x, 3), round(z, 3))

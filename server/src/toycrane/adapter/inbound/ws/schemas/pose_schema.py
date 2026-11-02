"""화면→서버 pose 메시지 검증: 배치에 있는 기계, 0.4초 묶음 f = [[나이(초), 집게 [x, y, z, 벌림] 4칸, 움직이는 인형들], …] 1~MAX_FRAMES개.
인형은 기계 종류별 상한(인형 기계 9개, 미는 뽑기 cap)까지 × 8칸 — 유한 숫자, 소수 2자리. 나이는 0~MAX_AGE초(가장 새것이 0)."""

from toycrane.adapter.inbound.ws.schemas.done_schema import _number, parse_pose
from toycrane.domain.layout import machine_spot
from toycrane.domain.report import limits_of

MAX_FRAMES, MAX_AGE = 10, 5.0  # 0.4초 묶음에 10Hz면 4개 — 여유
Frame = tuple[float, tuple[float, float, float, float], tuple[tuple[float, ...], ...]]


def _frame(fr: object, cap: int) -> Frame | None:
    if not (isinstance(fr, list) and len(fr) == 3):
        return None
    age, c, d = fr
    a = _number(age)
    if a is None or a < 0 or a > MAX_AGE or not (isinstance(c, list) and len(c) == 4 and isinstance(d, list) and len(d) <= cap):
        return None
    claw = [_number(v) for v in c]
    poses = [parse_pose(row, 2) for row in d]
    if any(v is None for v in claw) or any(p is None for p in poses):
        return None
    return round(a, 2), tuple(round(v, 2) for v in claw), tuple((p.uid, p.x, p.y, p.z, *p.q) for p in poses)  # type: ignore[arg-type,return-value]


def parse(data: dict) -> tuple[str, tuple[Frame, ...]] | None:
    m, f = data.get("m"), data.get("f")
    if not (isinstance(m, str) and machine_spot(m) is not None and isinstance(f, list) and 1 <= len(f) <= MAX_FRAMES):
        return None
    frames = [_frame(fr, limits_of(m).cap) for fr in f]
    if any(fr is None for fr in frames):
        return None
    return m, tuple(frames)  # type: ignore[arg-type]

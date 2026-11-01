"""화면→서버 pose 메시지 검증: 배치에 있는 기계, 집게 [x, y, z, 벌림] 4칸, 움직이는 인형 최대 9개 × 8칸 — 유한 숫자, 소수 2자리."""

from toycrane.adapter.inbound.ws.schemas.done_schema import _number, parse_pose
from toycrane.domain.layout import machine_spot
from toycrane.domain.stock import DOLLS_PER_MACHINE


def parse(data: dict) -> tuple[str, tuple[float, float, float, float], tuple[tuple[float, ...], ...]] | None:
    m, c, d = data.get("m"), data.get("c"), data.get("d")
    if not (isinstance(m, str) and machine_spot(m) is not None and isinstance(c, list) and len(c) == 4 and isinstance(d, list) and len(d) <= DOLLS_PER_MACHINE):
        return None
    claw = [_number(v) for v in c]
    poses = [parse_pose(row, 2) for row in d]
    if any(v is None for v in claw) or any(p is None for p in poses):
        return None
    return m, tuple(round(v, 2) for v in claw), tuple((p.uid, p.x, p.y, p.z, *p.q) for p in poses)  # type: ignore[arg-type,return-value]

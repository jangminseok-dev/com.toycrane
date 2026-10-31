"""화면→서버 done 메시지 검증: 배치에 있는 기계, 뽑힌 번호 최대 9개(정수), 멈춘 인형 최대 9개 × [번호, x, y, z, qx, qy, qz, qw](유한 숫자, 소수 3자리)."""

import math

from toycrane.domain.layout import MACHINES
from toycrane.domain.report import DollPose, Report
from toycrane.domain.stock import DOLLS_PER_MACHINE


def _number(value) -> float | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    return float(value) if math.isfinite(value) else None


def _uid(value) -> int | None:
    return value if isinstance(value, int) and not isinstance(value, bool) and value >= 0 else None


def parse_pose(row, digits: int) -> DollPose | None:
    if not isinstance(row, list) or len(row) != 8:
        return None
    uid = _uid(row[0])
    nums = [_number(v) for v in row[1:]]
    if uid is None or any(v is None for v in nums):
        return None
    x, y, z, qx, qy, qz, qw = (round(v, digits) for v in nums)  # type: ignore[arg-type]
    return DollPose(uid, x, y, z, (qx, qy, qz, qw))


def parse(data: dict) -> tuple[str, Report] | None:
    m, won, dolls = data.get("m"), data.get("won"), data.get("dolls")
    if not (isinstance(m, str) and m in MACHINES and isinstance(won, list) and isinstance(dolls, list)):
        return None
    if len(won) > DOLLS_PER_MACHINE or len(dolls) > DOLLS_PER_MACHINE:  # 당첨이 많은 건 도메인이 "wins"로 거절해 done_no가 가게 (최종 리뷰 I2)
        return None
    uids = [_uid(u) for u in won]
    poses = [parse_pose(row, 3) for row in dolls]
    if any(u is None for u in uids) or any(p is None for p in poses):
        return None
    return m, Report(tuple(uids), tuple(poses))  # type: ignore[arg-type]

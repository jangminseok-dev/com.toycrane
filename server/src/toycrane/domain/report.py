"""판 보고 확인 (물리 뽑기 설계 §4.5·§9.1·§9.7): 판을 한 화면이 보낸 "구멍에 빠진 인형들 + 멈춘 인형 전부의 자리·돌림"을
상식만 확인한다 — 번호가 기계와 맞는가, 뽑힌 인형이 최대 3개인가. 자리는 상자 안으로 잘라 받고 돌림은 길이 1로 맞춘다."""

import math
from dataclasses import dataclass, replace

from toycrane.domain.crane import DollSpot, Quat
from toycrane.domain.layout import MACHINE_SPEC
from toycrane.domain.shared_data import CLAW
from toycrane.domain.stock import MachineStock, on_taken

BOX_MARGIN = 0.1  # 놀이 영역 반폭보다 이만큼 밖까지(벽에 기댄 인형) 허용
BOX_TOP = 1.2


@dataclass(frozen=True)
class DollPose:
    uid: int
    x: float
    y: float
    z: float
    q: Quat


@dataclass(frozen=True)
class Report:
    won: tuple[int, ...]
    dolls: tuple[DollPose, ...]


def _clamp(v: float, lo: float, hi: float) -> float:
    return min(max(v, lo), hi)


def _unit(q: Quat) -> Quat:
    n = math.sqrt(sum(c * c for c in q))
    return (0.0, 0.0, 0.0, 1.0) if n < 1e-6 else tuple(c / n for c in q)  # type: ignore[return-value]


def check_report(stock: MachineStock, report: Report, now: float) -> MachineStock | str:
    """통과하면 새 MachineStock, 아니면 거절 이유: "wins"(당첨이 너무 많음) · "unknown"(기계에 없는 번호) · "count"(인형 수 불일치)."""
    if len(report.won) > CLAW["max_wins"]:
        return "wins"
    known = {d.uid for d in stock.dolls}
    reported = [p.uid for p in report.dolls]
    if any(u not in known for u in report.won) or any(u not in known for u in reported):
        return "unknown"
    if sorted(reported) != sorted(known - set(report.won)):
        return "count"
    w, d = MACHINE_SPEC.play_half
    poses = {p.uid: p for p in report.dolls}
    after = on_taken(stock, list(report.won), now)
    dolls = [
        replace(s, x=_clamp(poses[s.uid].x, -w - BOX_MARGIN, w + BOX_MARGIN), y=_clamp(poses[s.uid].y, 0.0, BOX_TOP),
                z=_clamp(poses[s.uid].z, -d - BOX_MARGIN, d + BOX_MARGIN), q=_unit(poses[s.uid].q))
        for s in after.dolls
    ]
    return MachineStock(dolls, after.next_at, after.next_uid)


def won_views(stock: MachineStock, won: tuple[int, ...]) -> list[tuple[str, int, str, int]]:
    """결과 메시지용 [캐릭터, 색, 희귀, 번호] — 보고 전 배치에서 찾는다."""
    by_uid = {d.uid: d for d in stock.dolls}
    return [(by_uid[u].kind, by_uid[u].color, by_uid[u].rare, u) for u in won]


def won_dolls(stock: MachineStock, won: tuple[int, ...]) -> list[DollSpot]:
    by_uid = {d.uid: d for d in stock.dolls}
    return [by_uid[u] for u in won]

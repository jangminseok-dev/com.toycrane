"""상자 기계(피규어·고리 걸기, 계획 12)의 규칙 한 벌: 기계 id들, 가방 구역, 새 상자, 판 보고 확인, 판 뒤 상자 — 판 보고 흐름은 같다.
함수는 기계 id를 받는다(피규어는 id로 상자 종류를 고른다)."""

from __future__ import annotations

import random
from collections.abc import Callable
from dataclasses import dataclass
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from toycrane.domain.figure import BoxPose, FigureState


@dataclass(frozen=True)
class BoxRules:
    machines: tuple[str, ...]
    zone: str
    start_box: Callable[[random.Random, str], BoxPose]
    check_report: Callable[[tuple[float, ...], bool, str], tuple[BoxPose, bool] | str]
    after_play: Callable[[FigureState, BoxPose, bool, random.Random, str], tuple[FigureState, bool]]

"""고리 뽑기 규칙(설계 2026-11-02 §3, 수치 shared/ring.json): 기계마다 구멍판 걸이 cols×rows에 경품 카드가 하나씩 걸려 있다(무엇인지 보인다).
화면은 갈고리 끝이 멈춘 자리(x, y, 기계 좌표)만 보내고, 서버가 가장 가까운 걸이의 고리 구멍과 창(window) 안인지 보고,
걸렸으면 출구까지 hold 확률로 정한다. 뽑힌 걸이에는 새 카드를 건다."""

import math
import random
from dataclasses import dataclass

from toycrane.domain.catalog import DOLLS, EFFECTS, GOLD
from toycrane.domain.shared_data import RING

_KINDS = tuple(DOLLS)


@dataclass(frozen=True)
class Card:
    kind: str  # 캐릭터
    color: int  # 색 0~5
    rare: str  # '' | 희귀 효과 id | 'gold'


@dataclass(frozen=True)
class HookResult:
    peg: int | None  # 창 안에 든 걸이(없으면 None)
    caught: bool  # 출구까지 왔나(경품)


def peg_xy(i: int) -> tuple[float, float]:
    """걸이 i(위 줄 왼쪽부터)의 구멍판 위 자리(기계 좌표 x, y) — 화면 data/rings.ts pegXY와 같다."""
    b = RING["board"]
    row = i // b["cols"]
    return b["x0"] + (i % b["cols"]) * b["dx"], b["y0"] + (b["rows"] - 1 - row) * b["dy"]


def new_card(rng: random.Random) -> Card:
    """새 카드: 24종·6색 중 무작위, 황금 0.5%·희귀 3%."""
    kind, color = rng.choice(_KINDS), rng.randrange(6)
    if rng.random() < RING["odds"]["gold"]:
        return Card(kind, color, GOLD)
    if rng.random() < RING["odds"]["rare"]:
        return Card(kind, color, rng.choice(EFFECTS))
    return Card(kind, color, "")


def new_board(rng: random.Random) -> tuple[Card, ...]:
    return tuple(new_card(rng) for _ in range(RING["board"]["cols"] * RING["board"]["rows"]))


def valid_hook(x: float, y: float) -> bool:
    """갈고리가 갈 수 있는 자리인가(숫자이고 움직일 수 있는 범위 안)."""
    (x0, x1), (y0, y1) = RING["hook"]["x"], RING["hook"]["y"]
    return math.isfinite(x) and math.isfinite(y) and x0 - 1e-6 <= x <= x1 + 1e-6 and y0 - 1e-6 <= y <= y1 + 1e-6


def hook(board: tuple[Card, ...], x: float, y: float, rng: random.Random) -> HookResult:
    """갈고리 끝 (x, y): 가장 가까운 걸이의 고리 구멍과 가로·세로 모두 창 안이면 걸리고, 출구까지는 hold 확률."""
    w = RING["catch"]["window"]
    near = min(range(len(board)), key=lambda i: math.dist(peg_xy(i), (x, y)))
    px, py = peg_xy(near)
    if abs(x - px) > w or abs(y - py) > w:
        return HookResult(None, False)
    return HookResult(near, rng.random() < RING["catch"]["hold"])


def restock(board: tuple[Card, ...], peg: int, rng: random.Random) -> tuple[Card, ...]:
    """뽑힌 걸이에 새 카드를 건다."""
    return tuple(new_card(rng) if i == peg else c for i, c in enumerate(board))

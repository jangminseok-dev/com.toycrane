"""코인 규칙 (설계 §3.3, 2026-10-31 교환소 개편 설계 §3.2·§4.1·§4.4).

교환소 '코인 받기'는 코인이 15개 미만일 때만 5개(15까지). 15개를 넘게 모으는 길은 조르기뿐이다:
교환소 조르기는 10~50개(게스트마다 10분에 한 번), 맵에서 조르는 사람에게는 다른 사람이 원하는 만큼 준다. 지갑 최대 99."""

import random

COINS_PER_TAKE = 5     # 교환소에서 한 번에 받는 코인
TAKE_LIMIT = 15        # 코인 받기로 채울 수 있는 데까지
WALLET_CAP = 99        # 지갑 최대 (넘는 만큼은 버림)
WINDOW_REACH = 1.5     # 창구에서 이만큼 안에 서 있어야 받기·조르기
BEG_MIN, BEG_MAX = 10, 50
BEG_COOLDOWN = 600.0   # 교환소 조르기는 게스트마다 10분에 한 번
GIVE_REACH = 1.5       # 조르는 사람에게 이만큼 다가가야 줄 수 있다
# 옛 줄 규칙 — 5단계 Task 3에서 줄 기능과 함께 지운다
TAKE_SECONDS = 2.0
TAKE_SLACK = 0.3
HEAD_TIMEOUT = 8.0
QUEUE_SLOTS = 6


def take_amount(balance: int) -> int:
    """코인 받기로 받을 개수 (15개까지 채움)."""
    return max(0, min(COINS_PER_TAKE, TAKE_LIMIT - balance))


def beg_award(rng: random.Random) -> int:
    return rng.randint(BEG_MIN, BEG_MAX)


def beg_wait(begged_at: float | None, now: float) -> float:
    """교환소 조르기까지 남은 초 (0이면 지금 받을 수 있음)."""
    return 0.0 if begged_at is None else max(0.0, begged_at + BEG_COOLDOWN - now)


def give_limit(giver: int, receiver: int) -> int:
    """줄 수 있는 최대: 내 코인과 받는 사람이 더 받을 수 있는 만큼 중 작은 쪽."""
    return max(0, min(giver, WALLET_CAP - receiver))

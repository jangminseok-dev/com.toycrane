"""고리 뽑기 규칙(설계 2026-11-02 §3): 구멍판 걸이 12개의 카드, 갈고리 창 안이면 걸리고 출구까지는 확률, 뽑힌 걸이엔 새 카드."""

import math
import random
from statistics import median

from toycrane.domain.catalog import DOLLS, EFFECTS, GOLD
from toycrane.domain.ring import Card, hook, new_board, peg_xy, restock, valid_hook
from toycrane.domain.shared_data import RING

W = RING["catch"]["window"]


def test_board_has_a_card_on_every_peg():
    board = new_board(random.Random(1))
    assert len(board) == RING["board"]["cols"] * RING["board"]["rows"] == 12
    for c in board:
        assert c.kind in DOLLS and 0 <= c.color < 6 and c.rare in ("", GOLD, *EFFECTS)


def test_rare_and_gold_cards_are_rare():
    rng, n = random.Random(2), 20000
    cards = [c for _ in range(n // 12) for c in new_board(rng)]
    gold = sum(c.rare == GOLD for c in cards) / len(cards)
    rare = sum(c.rare in EFFECTS for c in cards) / len(cards)
    assert 0.002 < gold < 0.009 and 0.02 < rare < 0.04


def test_hook_inside_the_window_can_catch():
    board, (x, y) = new_board(random.Random(1)), peg_xy(5)
    results = [hook(board, x + W * 0.6, y - W * 0.6, random.Random(s)) for s in range(400)]
    assert all(r.peg == 5 for r in results)
    caught = sum(r.caught for r in results) / len(results)
    assert abs(caught - RING["catch"]["hold"]) < 0.08  # 걸린 뒤 출구까지 hold 확률


def test_hook_outside_the_window_always_misses():
    board, (x, y) = new_board(random.Random(1)), peg_xy(5)
    for s in range(200):
        r = hook(board, x + W * 1.5, y, random.Random(s))
        assert r.peg is None and r.caught is False
    r = hook(board, x, y + W * 1.2, random.Random(3))
    assert r.peg is None and r.caught is False


def test_caught_card_is_replaced():
    board = new_board(random.Random(1))
    after = restock(board, 5, random.Random(9))
    assert len(after) == len(board)
    assert all(after[i] == board[i] for i in range(len(board)) if i != 5)
    assert isinstance(after[5], Card) and after[5] is not board[5]


def test_valid_hook_rejects_nan_and_out_of_range():
    x0, x1 = RING["hook"]["x"]
    y0, y1 = RING["hook"]["y"]
    assert valid_hook((x0 + x1) / 2, (y0 + y1) / 2)
    assert not valid_hook(math.nan, 1.4) and not valid_hook(0.0, math.inf)
    assert not valid_hook(x1 + 0.05, 1.4) and not valid_hook(0.0, y0 - 0.05)


def test_a_careful_player_needs_about_4_to_6_plays():
    """눈대중 오차 ±1.5cm로 걸이 하나를 노리는 사람 — 2000명의 판수 50%선이 4~6판."""
    rng, plays = random.Random(7), []
    for _ in range(2000):
        board = new_board(rng)
        for n in range(1, 200):
            x, y = peg_xy(rng.randrange(len(board)))
            if hook(board, x + rng.uniform(-0.015, 0.015), y + rng.uniform(-0.015, 0.015), rng).caught:
                plays.append(n)
                break
    assert 4 <= median(plays) <= 6

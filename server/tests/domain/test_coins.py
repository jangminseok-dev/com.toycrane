import random

from toycrane.domain.coins import beg_award, beg_wait, give_limit, take_amount


# 코인 규칙 (설계 2026-10-31 교환소 개편 §3.2·§4.1·§4.4)
def test_take_tops_up_to_fifteen():
    assert [take_amount(b) for b in (0, 10, 12, 15, 40)] == [5, 5, 3, 0, 0]


def test_beg_award_is_ten_to_fifty():
    rng = random.Random(1)
    got = {beg_award(rng) for _ in range(5000)}
    assert min(got) == 10 and max(got) == 50 and len(got) == 41


def test_beg_waits_ten_minutes():
    assert beg_wait(None, 100.0) == 0 and beg_wait(100.0, 700.0) == 0 and beg_wait(100.0, 400.0) == 300.0


def test_give_limit_respects_both_wallets():
    assert give_limit(30, 0) == 30 and give_limit(30, 90) == 9 and give_limit(0, 0) == 0 and give_limit(5, 99) == 0

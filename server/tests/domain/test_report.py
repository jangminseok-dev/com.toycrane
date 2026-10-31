import random

import pytest

from toycrane.domain.layout import MACHINE_SPEC
from toycrane.domain.report import DollPose, Report, check_report
from toycrane.domain.stock import generate_stock

UP = (0.0, 0.0, 0.0, 1.0)


def settled(stock):
    """시뮬레이션처럼: 모든 인형이 바닥에 앉은 보고."""
    return [DollPose(d.uid, d.x, 0.87, d.z, UP) for d in stock.dolls]


def stock9():
    return generate_stock("bear", random.Random(1))


# 물리 뽑기 설계 §9.7: 자리가 상자 밖으로 조금 나간 건 잘라서 받는다 — 돌림은 길이 1로
def test_positions_outside_the_box_are_clamped_not_refused():
    s = stock9()
    poses = settled(s)
    poses[0] = DollPose(poses[0].uid, 0.9, -0.2, -0.7, (0.0, 0.0, 0.0, 2.0))
    after = check_report(s, Report((), tuple(poses)), now=10.0)
    assert not isinstance(after, str)
    w, d = MACHINE_SPEC.play_half
    moved = next(x for x in after.dolls if x.uid == poses[0].uid)
    assert (moved.x, moved.y, moved.z) == (w + 0.1, 0.0, -(d + 0.1)) and moved.q == pytest.approx((0, 0, 0, 1))
    assert all(x.settled for x in after.dolls) and after.next_at is None


def test_four_wins_are_refused():
    s = stock9()
    poses = [p for p in settled(s) if p.uid > 4]
    assert check_report(s, Report((1, 2, 3, 4), tuple(poses)), now=10.0) == "wins"


def test_missing_or_extra_dolls_are_refused():
    s = stock9()
    poses = settled(s)
    assert check_report(s, Report((), tuple(poses[:-1])), now=10.0) == "count"
    assert check_report(s, Report((1,), tuple(poses)), now=10.0) == "count"  # 뽑혔다는 인형이 자리 목록에도 있음


def test_unknown_uid_is_refused():
    s = stock9()
    poses = settled(s)
    assert check_report(s, Report((42,), tuple(poses)), now=10.0) == "unknown"
    poses[0] = DollPose(99, 0, 0.87, 0, UP)
    assert check_report(s, Report((), tuple(poses)), now=10.0) == "unknown"


def test_won_dolls_leave_and_the_rest_keep_reported_poses():
    s = stock9()
    poses = [DollPose(p.uid, p.x, 0.9 + p.uid * 0.01, p.z, (0.0, 0.70711, 0.0, 0.70711)) for p in settled(s) if p.uid not in (3, 7)]
    after = check_report(s, Report((3, 7), tuple(poses)), now=100.0)
    assert [d.uid for d in after.dolls] == [1, 2, 4, 5, 6, 8, 9]
    assert after.dolls[0].y == pytest.approx(0.91) and after.dolls[0].q == pytest.approx((0, 0.70711, 0, 0.70711), abs=1e-4)
    assert after.next_at == 130.0 and after.next_uid == s.next_uid
    assert after.dolls[0].color == s.dolls[0].color and after.dolls[0].kind == "bear"

from pytest import approx

from toycrane.domain.movement import BUDGET_CAP, accept_move
from toycrane.domain.value_objects.position import Position


def test_within_budget_is_accepted_and_spent():
    pos, left = accept_move(Position(0, 3), 0.6, 0.0, Position(1.5, 3), now=0.5)
    assert pos == Position(1.5, 3) and left == approx(1.5)


def test_teleport_moves_only_as_far_as_the_budget():
    pos, left = accept_move(Position(0, 3), 0.6, 0.0, Position(9, 3), now=0.5)
    assert (pos.x, pos.z) == (approx(3.0), 3) and left == 0


# 오래 서 있어도 예산은 2초 분량까지만 쌓인다 — 서 있다가 매장 끝으로 순간이동 금지 (최종 리뷰 #7)
# (z=12 가로줄: 큰 홀에서 끝점이 기계·교환소·장식 장애물에 걸리지 않게)
def test_long_idle_does_not_allow_teleport():
    pos, left = accept_move(Position(-12, 12), 0.6, 0.0, Position(12, 12), now=60.0)
    assert (pos.x, pos.z) == (approx(-12 + BUDGET_CAP), 12) and left == 0


# 끊겼다가 몰려 도착한 메시지(0.5초 간격으로 보냈는데 10ms 간격 도착)는 쌓인 예산으로 받아 준다 (최종 리뷰 #7)
def test_bunched_messages_use_saved_budget():
    pos, left = accept_move(Position(3.2, 3), 2.0, 1.0, Position(4.8, 3), now=1.01)
    assert pos == Position(4.8, 3) and left == approx(0.448)


def test_clamped_to_floor_edge():
    # z=12: 큰 홀 동쪽 벽 앞 빈 바닥 가장자리(피규어 장식 z ±9.1과 쉼터 z 15부터의 사이)
    pos, _ = accept_move(Position(21.5, 12), 0.6, 0.0, Position(21.9, 12), now=0.5)
    assert pos == Position(21.6, 12)


def test_pushed_out_of_tower():
    pos, _ = accept_move(Position(0.5, 2.0), 0.6, 0.0, Position(0.5, 1.0), now=0.2)
    assert pos == Position(0.5, 1.6)

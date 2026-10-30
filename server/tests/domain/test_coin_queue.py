from toycrane.domain.coin_queue import can_take, stale_head


def test_head_goes_stale_after_8_seconds():
    assert not stale_head(None, 100.0)          # 아직 맨 앞 표시 전
    assert not stale_head(1.0, 9.0)
    assert stale_head(1.0, 9.5)


def test_take_waits_two_seconds_with_slack():
    assert not can_take(None, 10.0)
    assert not can_take(1.0, 2.6)
    assert can_take(1.0, 2.7)

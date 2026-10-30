"""교환소 줄 규칙 — 타이머 없이 "다음 메시지가 올 때" 시각을 비교해서 판단한다."""

from toycrane.domain.coins import HEAD_TIMEOUT, TAKE_SECONDS, TAKE_SLACK


def stale_head(head_since: float | None, now: float) -> bool:
    """맨 앞이 된 지 8초가 넘도록 안 받았다(창을 내렸거나 자리를 비움)."""
    return head_since is not None and now - head_since > HEAD_TIMEOUT


def can_take(head_since: float | None, now: float) -> bool:
    """맨 앞이 된 뒤 창구 처리 시간(2초, 여유 0.3초)이 지났다."""
    return head_since is not None and now >= head_since + TAKE_SECONDS - TAKE_SLACK

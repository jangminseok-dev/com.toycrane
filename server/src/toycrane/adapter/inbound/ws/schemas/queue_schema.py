"""화면→서버 queue 메시지 검증: 교환소 번호(0·1)만 받는다."""

from toycrane.domain.layout import COUNTERS


def parse_join(data: dict) -> int | None:
    c = data.get("c")
    if isinstance(c, bool) or not isinstance(c, int) or not 0 <= c < len(COUNTERS):
        return None
    return c

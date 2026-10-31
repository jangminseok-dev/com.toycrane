"""화면→서버 give 메시지 검증: 받는 사람 id(문자열)와 개수(1~99 정수)."""

from toycrane.domain.coins import WALLET_CAP


def parse(data: dict) -> tuple[str, int] | None:
    to, n = data.get("to"), data.get("n")
    if not isinstance(to, str) or not 0 < len(to) <= 64:
        return None
    if isinstance(n, bool) or not isinstance(n, int) or not 1 <= n <= WALLET_CAP:
        return None
    return to, n

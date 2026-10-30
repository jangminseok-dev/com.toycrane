"""매장 규칙: 정원, 매장 고르기."""

STORE_CAPACITY = 50


def choose_store(counts: dict[int, int], max_stores: int) -> int | None:
    """1..max_stores 중 정원이 남은 가장 작은 번호. 사람이 모여 있게 앞 매장부터 채운다."""
    return next((n for n in range(1, max_stores + 1) if counts.get(n, 0) < STORE_CAPACITY), None)

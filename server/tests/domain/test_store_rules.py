from toycrane.domain.store_rules import choose_store


def test_fills_lowest_open_store():
    assert choose_store({1: 50, 2: 12}, max_stores=4) == 2


def test_opens_next_store_when_all_full():
    assert choose_store({1: 50, 2: 50}, max_stores=4) == 3


def test_empty_starts_at_one():
    assert choose_store({}, max_stores=4) == 1


def test_full_when_every_store_full():
    assert choose_store({1: 50, 2: 50, 3: 50, 4: 50}, max_stores=4) is None

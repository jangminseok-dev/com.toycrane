import pytest

from toycrane.domain.nickname import InvalidNickname, normalize_nickname


def test_normalize_trims_and_collapses_spaces():
    assert normalize_nickname("  말랑   토끼 ") == "말랑 토끼"


def test_emoji_and_korean_allowed():
    assert normalize_nickname("토끼🐰") == "토끼🐰"


@pytest.mark.parametrize("raw", ["", "   ", "가나다라마바사아자차카", "a\u0000b", "a\nb"])
def test_rejects(raw):
    with pytest.raises(InvalidNickname):
        normalize_nickname(raw)

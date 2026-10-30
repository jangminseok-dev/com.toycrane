import unicodedata

MAX_NICKNAME = 10


class InvalidNickname(ValueError):
    pass


def normalize_nickname(raw: str) -> str:
    """앞뒤 공백 제거, 연속 공백은 하나로. 1~10자, 제어 문자(줄바꿈 포함) 금지."""
    if any(unicodedata.category(ch) == "Cc" for ch in raw):
        raise InvalidNickname(raw)
    name = " ".join(raw.split())
    if not 1 <= len(name) <= MAX_NICKNAME:
        raise InvalidNickname(raw)
    return name

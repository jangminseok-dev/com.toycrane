"""화면→서버 beg 메시지 검증: on(참·거짓)만 받는다."""


def parse(data: dict) -> bool | None:
    on = data.get("on")
    return on if isinstance(on, bool) else None

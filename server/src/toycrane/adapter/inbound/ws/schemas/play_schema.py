"""화면→서버 play 메시지 검증: 배치에 있는 기계 id만."""

from toycrane.domain.layout import machine_spot


def parse(data: dict) -> str | None:
    m = data.get("m")
    return m if isinstance(m, str) and machine_spot(m) is not None else None

"""인터랙터 테스트용 가짜 포트. 태스크가 늘 때마다 여기에 추가한다."""


class FakeRecordPort:
    def __init__(self) -> None:
        self.calls: list[tuple[str, str]] = []

    async def record(self, subject: str, note: str) -> None:
        self.calls.append((subject, note))

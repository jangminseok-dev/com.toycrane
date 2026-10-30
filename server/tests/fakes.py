"""인터랙터 테스트용 가짜 포트. 태스크가 늘 때마다 여기에 추가한다."""

from toycrane.app.dtos.guest_dto import GuestView


class FakeRecordPort:
    def __init__(self) -> None:
        self.calls: list[tuple[str, str]] = []

    async def record(self, subject: str, note: str) -> None:
        self.calls.append((subject, note))


class FakeGuestRepository:
    def __init__(self) -> None:
        self.rows: dict[str, tuple[GuestView, float]] = {}
        self.touched: list[tuple[str, float]] = []

    async def insert(self, view: GuestView, now: float) -> None:
        self.rows[view.guest_id] = (view, now)

    async def get(self, guest_id: str) -> GuestView | None:
        row = self.rows.get(guest_id)
        return row[0] if row else None

    async def touch(self, guest_id: str, now: float) -> None:
        self.touched.append((guest_id, now))


class FakeOccupancy:
    def __init__(self, counts_value: dict[int, int] | None = None) -> None:
        self.counts_value = dict(counts_value or {})
        self.writes: list[tuple[int, int, float]] = []

    async def counts(self) -> dict[int, int]:
        return dict(self.counts_value)

    async def write(self, store_no: int, count: int, now: float) -> None:
        self.writes.append((store_no, count, now))
        self.counts_value[store_no] = count

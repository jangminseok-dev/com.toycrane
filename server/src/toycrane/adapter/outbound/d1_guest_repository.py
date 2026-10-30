from toycrane.adapter.runtime import to_py
from toycrane.app.dtos.guest_dto import GuestView
from toycrane.app.ports.output.guest_repository import GuestRepository


class D1GuestRepository(GuestRepository):
    def __init__(self, db) -> None:
        self._db = db

    async def insert(self, view: GuestView, now: float) -> None:
        await self._db.prepare(
            "INSERT INTO guests (guest_id, nickname, color, created_at, last_seen) VALUES (?, ?, ?, ?, ?)"
        ).bind(view.guest_id, view.nickname, view.color, now, now).run()

    async def get(self, guest_id: str) -> GuestView | None:
        row = to_py(await self._db.prepare("SELECT guest_id, nickname, color FROM guests WHERE guest_id = ?").bind(guest_id).first())
        return GuestView(row["guest_id"], row["nickname"], int(row["color"])) if row else None

    async def touch(self, guest_id: str, now: float) -> None:
        await self._db.prepare("UPDATE guests SET last_seen = ? WHERE guest_id = ?").bind(now, guest_id).run()

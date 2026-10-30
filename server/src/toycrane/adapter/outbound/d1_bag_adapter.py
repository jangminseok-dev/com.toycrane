from toycrane.adapter.outbound.js_values import to_py
from toycrane.app.ports.output.bag_port import BagPort


class D1BagAdapter(BagPort):
    def __init__(self, db) -> None:
        self._db = db

    async def total(self, guest_id: str) -> int:
        row = to_py(await self._db.prepare("SELECT COALESCE(SUM(count), 0) AS n FROM bag WHERE guest_id = ?").bind(guest_id).first())
        return int(row["n"]) if row else 0

    async def add(self, guest_id: str, doll: str, zone: str, now: float) -> int:
        await self._db.prepare(
            "INSERT INTO bag (guest_id, doll, zone, count, first_at) VALUES (?1, ?2, ?3, 1, ?4) "
            "ON CONFLICT(guest_id, doll, zone) DO UPDATE SET count = count + 1"
        ).bind(guest_id, doll, zone, now).run()
        return await self.total(guest_id)

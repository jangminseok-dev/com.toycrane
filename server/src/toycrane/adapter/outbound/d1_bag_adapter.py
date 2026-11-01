from toycrane.adapter.outbound.js_values import to_py
from toycrane.app.dtos.bag_dto import BagEntry
from toycrane.app.ports.output.bag_port import BagPort

LIST_SQL = "SELECT doll, color, rare, zone, count, first_at FROM bag WHERE guest_id = ? ORDER BY first_at DESC"


def rows_to_entries(rows: list[dict]) -> list[BagEntry]:
    return [BagEntry(r["doll"], int(r["color"]), r["rare"], r["zone"], int(r["count"]), float(r["first_at"])) for r in rows]


class D1BagAdapter(BagPort):
    def __init__(self, db) -> None:
        self._db = db

    async def total(self, guest_id: str) -> int:
        row = to_py(await self._db.prepare("SELECT COALESCE(SUM(count), 0) AS n FROM bag WHERE guest_id = ?").bind(guest_id).first())
        return int(row["n"]) if row else 0

    async def add(self, guest_id: str, doll: str, color: int, rare: str, zone: str, now: float) -> int:
        await self._db.prepare(
            "INSERT INTO bag (guest_id, doll, color, rare, zone, count, first_at) VALUES (?1, ?2, ?3, ?4, ?5, 1, ?6) "
            "ON CONFLICT(guest_id, doll, color, rare, zone) DO UPDATE SET count = count + 1"
        ).bind(guest_id, doll, color, rare, zone, now).run()
        return await self.total(guest_id)

    async def items(self, guest_id: str) -> list[BagEntry]:
        res = to_py(await self._db.prepare(LIST_SQL).bind(guest_id).all())
        return rows_to_entries(res.get("results", []) if res else [])

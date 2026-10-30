from toycrane.adapter.runtime import to_py
from toycrane.app.ports.output.occupancy_port import OccupancyPort


class D1OccupancyAdapter(OccupancyPort):
    def __init__(self, db) -> None:
        self._db = db

    async def counts(self, fresh_since: float) -> dict[int, int]:
        result = to_py(await self._db.prepare("SELECT store_no, count FROM store_occupancy WHERE updated_at >= ?").bind(fresh_since).all())
        return {int(r["store_no"]): int(r["count"]) for r in result["results"]}

    async def write(self, store_no: int, count: int, now: float) -> None:
        await self._db.prepare(
            "INSERT INTO store_occupancy (store_no, count, updated_at) VALUES (?, ?, ?) "
            "ON CONFLICT(store_no) DO UPDATE SET count = excluded.count, updated_at = excluded.updated_at"
        ).bind(store_no, count, now).run()

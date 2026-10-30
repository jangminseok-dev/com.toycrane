from toycrane.adapter.runtime import to_py
from toycrane.app.ports.output.wallet_port import WalletPort


class D1WalletAdapter(WalletPort):
    def __init__(self, db) -> None:
        self._db = db

    async def balance(self, guest_id: str) -> int:
        row = to_py(await self._db.prepare("SELECT coins FROM wallets WHERE guest_id = ?").bind(guest_id).first())
        return int(row["coins"]) if row else 0

    async def add(self, guest_id: str, n: int, cap: int, now: float) -> int:
        row = to_py(await self._db.prepare(
            "INSERT INTO wallets (guest_id, coins, updated_at) VALUES (?1, MIN(?2, ?3), ?4) "
            "ON CONFLICT(guest_id) DO UPDATE SET coins = MIN(coins + ?2, ?3), updated_at = ?4 RETURNING coins"
        ).bind(guest_id, n, cap, now).first())
        return int(row["coins"])

    async def spend_one(self, guest_id: str, now: float) -> int | None:
        row = to_py(await self._db.prepare(
            "UPDATE wallets SET coins = coins - 1, updated_at = ?2 WHERE guest_id = ?1 AND coins >= 1 RETURNING coins"
        ).bind(guest_id, now).first())
        return int(row["coins"]) if row else None

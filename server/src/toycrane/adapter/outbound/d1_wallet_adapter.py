from toycrane.adapter.outbound.js_values import to_py
from toycrane.app.ports.output.wallet_port import WalletPort

# 교환소 조르기: 새 게스트면 바로 넣고, 있으면 쿨타임이 지났고 cap 미만일 때만 더한다 — 조건과 변경을 한 문장에
# (?1 게스트, ?2 개수, ?3 cap, ?4 쿨타임 초, ?5 지금). 조건이 안 맞으면 행이 돌아오지 않는다
BEG_SQL = (
    "INSERT INTO wallets (guest_id, coins, updated_at, begged_at) VALUES (?1, MIN(?2, ?3), ?5, ?5) "
    "ON CONFLICT(guest_id) DO UPDATE SET coins = MIN(coins + ?2, ?3), updated_at = ?5, begged_at = ?5 "
    "WHERE (begged_at IS NULL OR begged_at <= ?5 - ?4) AND coins < ?3 RETURNING coins"
)
# 코인 주기: 받는 사람 지갑 행을 먼저 만들어 두고(0개), 두 행을 UPDATE 한 문장으로 함께 바꾼다
# (?1 주는 사람, ?2 받는 사람, ?3 개수, ?4 cap, ?5 지금). 조건이 안 맞으면 아무 행도 안 바뀐다
ENSURE_SQL = "INSERT OR IGNORE INTO wallets (guest_id, coins, updated_at) VALUES (?1, 0, ?2)"
TRANSFER_SQL = (
    "UPDATE wallets SET coins = CASE guest_id WHEN ?1 THEN coins - ?3 ELSE coins + ?3 END, updated_at = ?5 "
    "WHERE guest_id IN (?1, ?2) AND (SELECT coins FROM wallets WHERE guest_id = ?1) >= ?3 "
    "AND (SELECT coins FROM wallets WHERE guest_id = ?2) + ?3 <= ?4 RETURNING guest_id, coins"
)


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

    async def beg(self, guest_id: str, n: int, cap: int, cooldown: float, now: float) -> int | None:
        row = to_py(await self._db.prepare(BEG_SQL).bind(guest_id, n, cap, cooldown, now).first())
        return int(row["coins"]) if row else None

    async def begged_at(self, guest_id: str) -> float | None:
        row = to_py(await self._db.prepare("SELECT begged_at FROM wallets WHERE guest_id = ?").bind(guest_id).first())
        return float(row["begged_at"]) if row and row["begged_at"] is not None else None

    async def transfer(self, giver: str, receiver: str, n: int, cap: int, now: float) -> tuple[int, int] | None:
        await self._db.prepare(ENSURE_SQL).bind(receiver, now).run()
        result = to_py(await self._db.prepare(TRANSFER_SQL).bind(giver, receiver, n, cap, now).all())
        rows = {r["guest_id"]: int(r["coins"]) for r in result["results"]}
        return (rows[giver], rows[receiver]) if giver in rows and receiver in rows else None

    async def spend_one(self, guest_id: str, now: float) -> int | None:
        row = to_py(await self._db.prepare(
            "UPDATE wallets SET coins = coins - 1, updated_at = ?2 WHERE guest_id = ?1 AND coins >= 1 RETURNING coins"
        ).bind(guest_id, now).first())
        return int(row["coins"]) if row else None

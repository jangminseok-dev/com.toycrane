import sqlite3
from pathlib import Path

from toycrane.adapter.outbound.d1_wallet_adapter import BEG_SQL

MIGRATIONS = Path(__file__).resolve().parents[2] / "migrations"


def wallets() -> sqlite3.Connection:
    db = sqlite3.connect(":memory:")
    for name in ("0002_coins_bag.sql", "0004_counter_beg.sql"):
        db.executescript((MIGRATIONS / name).read_text(encoding="utf-8"))
    return db


def beg(db, guest: str, n: int, now: float, cap: int = 99, cooldown: float = 600.0):
    row = db.execute(BEG_SQL, (guest, n, cap, cooldown, now)).fetchone()
    db.commit()
    return row[0] if row else None


# Review Focus 1: 같은 게스트의 탭 두 개가 같은 순간 눌러도 한 번만 받는다 (조건과 변경을 SQL 한 문장에)
def test_beg_sql_grants_once_per_cooldown():
    db = wallets()
    assert beg(db, "g-1", 20, now=1000.0) == 20
    assert beg(db, "g-1", 30, now=1000.0) is None
    assert beg(db, "g-1", 30, now=1599.0) is None
    assert beg(db, "g-1", 30, now=1600.0) == 50


def test_beg_sql_caps_at_99_and_full_wallet_keeps_its_time():
    db = wallets()
    db.execute("INSERT INTO wallets (guest_id, coins, updated_at) VALUES ('g-1', 90, 0)")
    assert beg(db, "g-1", 40, now=1000.0) == 99
    assert beg(db, "g-1", 40, now=5000.0) is None  # 가득 차면 받지 않고 시각도 그대로
    assert db.execute("SELECT begged_at FROM wallets").fetchone()[0] == 1000.0


from toycrane.adapter.outbound.d1_wallet_adapter import ENSURE_SQL, TRANSFER_SQL  # noqa: E402


def transfer(db, frm: str, to: str, n: int, now: float = 1.0, cap: int = 99):
    db.execute(ENSURE_SQL, (to, now))
    rows = dict(db.execute(TRANSFER_SQL, (frm, to, n, cap, now)).fetchall())
    db.commit()
    return (rows[frm], rows[to]) if rows else None


def balances(db) -> dict:
    return dict(db.execute("SELECT guest_id, coins FROM wallets").fetchall())


# Review Focus 2: 어느 지갑도 음수나 99 초과가 되지 않고, 옮긴 만큼만 바뀐다 (행 순서가 어느 쪽이어도)
def test_give_sql_never_breaks_wallets():
    for order in (["g1", "g2"], ["g2", "g1"]):
        db = wallets()
        for g in order:
            db.execute("INSERT INTO wallets (guest_id, coins, updated_at) VALUES (?, ?, 0)", (g, {"g1": 10, "g2": 95}[g]))
        assert transfer(db, "g1", "g2", 5) is None  # 100 > 99
        assert transfer(db, "g1", "g2", 4) == (6, 99)
        assert transfer(db, "g1", "g3", 7) is None  # 6 < 7
        assert transfer(db, "g9", "g1", 1) is None  # 지갑 없는 사람은 줄 수 없다
        assert balances(db) == {"g1": 6, "g2": 99, "g3": 0}

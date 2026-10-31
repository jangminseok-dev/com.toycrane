import sqlite3
from pathlib import Path

MIGRATIONS = Path(__file__).resolve().parents[2] / "migrations"


def migrated(rows: list[tuple]) -> sqlite3.Connection:
    """0002 표에 옛 행을 넣고 0003을 적용한 메모리 DB."""
    db = sqlite3.connect(":memory:")
    db.executescript((MIGRATIONS / "0002_coins_bag.sql").read_text(encoding="utf-8"))
    db.executemany("INSERT INTO bag (guest_id, doll, zone, count, first_at) VALUES (?, ?, ?, ?, ?)", rows)
    db.executescript((MIGRATIONS / "0003_bag_variants.sql").read_text(encoding="utf-8"))
    return db


# Review Focus 5: 옛 가방의 희귀 캐릭터 4종은 그 캐릭터의 희귀판으로 (설계 2026-10-31 인형 채우기 §4.2)
def test_bag_migration_maps_legacy_rares():
    db = migrated([("g-1", "goldfox", "big", 1, 5.0), ("g-1", "bear", "big", 2, 3.0)])
    rows = db.execute("SELECT doll, color, rare, count FROM bag ORDER BY doll").fetchall()
    assert rows == [("bear", 0, "", 2), ("fox", 0, "gold", 1)]


def test_bag_migration_keeps_every_doll():
    db = migrated([("g-1", "starbunny", "big", 2, 5.0), ("g-1", "bunny", "big", 3, 1.0), ("g-2", "pearlpenguin", "big", 1, 2.0), ("g-2", "rainbowdino", "big", 4, 2.0)])
    assert db.execute("SELECT SUM(count) FROM bag").fetchone() == (10,)
    assert db.execute("SELECT guest_id, doll, rare, count FROM bag ORDER BY guest_id, doll").fetchall() == [
        ("g-1", "bunny", "", 3), ("g-1", "bunny", "star", 2), ("g-2", "dino", "rainbow", 4), ("g-2", "penguin", "pearl", 1),
    ]


def test_new_bag_counts_each_color_and_rare_apart():
    db = migrated([])
    add = "INSERT INTO bag (guest_id, doll, color, rare, zone, count, first_at) VALUES (?, ?, ?, ?, 'big', 1, 0) " \
          "ON CONFLICT(guest_id, doll, color, rare, zone) DO UPDATE SET count = count + 1"
    for doll, color, rare in [("bear", 1, ""), ("bear", 1, ""), ("bear", 2, ""), ("bear", 0, "star")]:
        db.execute(add, ("g-1", doll, color, rare))
    assert db.execute("SELECT color, rare, count FROM bag ORDER BY color, rare").fetchall() == [(0, "star", 1), (1, "", 2), (2, "", 1)]

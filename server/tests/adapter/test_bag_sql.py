import sqlite3
from pathlib import Path

from toycrane.adapter.inbound.http.schemas.bag_schema import to_json
from toycrane.adapter.outbound.d1_bag_adapter import ADD_SQL, LIST_SQL, rows_to_entries
from toycrane.app.dtos.bag_dto import BagEntry

MIGRATIONS = Path(__file__).resolve().parents[2] / "migrations"


def bag(rows: list[tuple]) -> sqlite3.Connection:
    db = sqlite3.connect(":memory:")
    for name in ("0002_coins_bag.sql", "0003_bag_variants.sql"):
        db.executescript((MIGRATIONS / name).read_text(encoding="utf-8"))
    db.executemany("INSERT INTO bag (guest_id, doll, color, rare, zone, count, first_at) VALUES (?, ?, ?, ?, ?, ?, ?)", rows)
    return db


def listed(db, guest: str) -> list[BagEntry]:
    cur = db.execute(LIST_SQL, (guest,))
    names = [d[0] for d in cur.description]
    return rows_to_entries([dict(zip(names, r)) for r in cur.fetchall()])


# 가방 보기(설계 2026-11-02 §5): 그 게스트의 행만, 처음 뽑은 때가 늦은 것부터
def test_bag_lists_items_newest_first():
    db = bag([
        ("g-1", "bear", 0, "", "big", 2, 10.0),
        ("g-1", "fox", 3, "gold", "ring", 1, 30.0),
        ("g-2", "cat", 1, "", "big", 5, 40.0),
        ("g-1", "penguin", 2, "", "figure", 1, 20.0),
    ])
    assert listed(db, "g-1") == [
        BagEntry("fox", 3, "gold", "ring", 1, 30.0),
        BagEntry("penguin", 2, "", "figure", 1, 20.0),
        BagEntry("bear", 0, "", "big", 2, 10.0),
    ]


def test_unknown_guest_gets_an_empty_list():
    assert listed(bag([("g-1", "bear", 0, "", "big", 2, 10.0)]), "nobody") == []


def test_bag_json_carries_each_entry():
    assert to_json([BagEntry("fox", 3, "gold", "ring", 1, 30.0)]) == {
        "items": [{"doll": "fox", "color": 3, "rare": "gold", "zone": "ring", "count": 1, "first_at": 30.0}],
    }


# 가방 NEW(설계 2026-11-24 bag-viewer-new): 넣기가 그 칸의 개수를 돌려줘 1이면 처음 생긴 칸
def test_add_returns_the_cell_count_so_a_first_cell_is_new():
    db = bag([])
    first = db.execute(ADD_SQL, ("g-1", "bear", 2, "", "big", 10.0)).fetchone()[0]
    again = db.execute(ADD_SQL, ("g-1", "bear", 2, "", "big", 11.0)).fetchone()[0]
    other = db.execute(ADD_SQL, ("g-1", "bear", 2, "", "pusher", 12.0)).fetchone()[0]  # 다른 구역은 다른 칸
    assert (first, again, other) == (1, 2, 1)

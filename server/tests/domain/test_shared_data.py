import json
from pathlib import Path

from toycrane.domain import catalog, layout, shared_data

SHARED = Path(__file__).resolve().parents[3] / "shared"


def test_generated_module_matches_shared_json():
    assert shared_data.CATALOG == json.loads((SHARED / "catalog.json").read_text(encoding="utf-8"))
    assert shared_data.LAYOUT == json.loads((SHARED / "store_layout.json").read_text(encoding="utf-8"))


def test_catalog_has_four_sets_of_six_plus_one_rare():
    assert len(catalog.DOLLS) == 28
    for s in catalog.SET_IDS:
        normals, rare = catalog.set_kinds(s)
        assert len(normals) == 6 and catalog.DOLLS[rare].rare
    assert catalog.is_rare("starbunny") and not catalog.is_rare("bunny") and not catalog.is_rare("nope")


def test_layout_has_35_big_machines_in_three_rows():
    ids = layout.MACHINE_IDS
    assert len(ids) == 35 and ids[0] == "A-1" and ids[13] == "B-1" and ids[-1] == "C-11"
    a1, b1 = layout.MACHINES["A-1"], layout.MACHINES["B-1"]
    assert (a1.x, a1.z, a1.ry, a1.set, a1.row) == (-11.1, -12.35, 0, "soft", "wall")
    assert (b1.x, b1.z, b1.set) == (-9.25, -7.6, "forest")  # 14번째 → 13 % 4 = 1


def test_front_spot_is_in_front_of_the_machine():
    f = layout.front_spot(layout.MACHINES["A-1"])
    assert (round(f.x, 2), round(f.z, 2)) == (-11.1, -11.2)
    f = layout.front_spot(layout.MACHINES["B-1"])
    assert (round(f.x, 2), round(f.z, 2)) == (-9.25, -8.75)


def test_counters_have_six_slots_starting_at_the_window():
    assert len(layout.COUNTERS) == 2
    for c in layout.COUNTERS:
        assert len(c.queue) == 6 and c.queue[0] == c.window

import json
from pathlib import Path

from toycrane.domain import catalog, layout, shared_data

SHARED = Path(__file__).resolve().parents[3] / "shared"


def test_generated_module_matches_shared_json():
    assert shared_data.CATALOG == json.loads((SHARED / "catalog.json").read_text(encoding="utf-8"))
    assert shared_data.LAYOUT == json.loads((SHARED / "store_layout.json").read_text(encoding="utf-8"))


def test_one_kind_per_machine_and_24_machines():
    from toycrane.domain.catalog import DOLLS
    from toycrane.domain.layout import MACHINES
    assert len(MACHINES) == 24 and sorted(m.kind for m in MACHINES.values()) == sorted(DOLLS)
    assert not any(m.id.startswith("B-") for m in MACHINES.values())


def test_every_doll_has_six_named_colors_and_eight_effects_exist():
    from toycrane.domain.catalog import DOLLS, EFFECTS
    assert all(len(d.palette) == 6 for d in DOLLS.values()) and len(EFFECTS) == 8


def test_legacy_rare_ids_map_to_rare_versions():
    from toycrane.domain.catalog import legacy_kind
    assert legacy_kind("goldfox") == ("fox", "gold") and legacy_kind("starbunny") == ("bunny", "star") and legacy_kind("bear") == ("bear", "")


def test_machines_mix_the_sets_in_layout_order():
    ids = layout.MACHINE_IDS
    assert ids[0] == "A-1" and ids[13] == "C-1" and ids[-1] == "C-11"
    a1, c1 = layout.MACHINES["A-1"], layout.MACHINES["C-1"]
    assert (a1.x, a1.z, a1.ry, a1.kind, a1.row) == (-11.1, -12.35, 0, "bunny", "wall")
    assert (c1.kind, c1.row) == ("owl", "island")  # 14번째 → 13 % 4 = 1(숲), 숲의 네 번째


def test_front_spot_is_in_front_of_the_machine():
    f = layout.front_spot(layout.MACHINES["A-1"])
    assert (round(f.x, 2), round(f.z, 2)) == (-11.1, -11.2)
    f = layout.front_spot(layout.MACHINES["C-1"])
    assert (round(f.x, 2), round(f.z, 2)) == (-9.25, -5.4)


def test_counters_have_six_slots_starting_at_the_window():
    assert len(layout.COUNTERS) == 2
    for c in layout.COUNTERS:
        assert len(c.queue) == 6 and c.queue[0] == c.window

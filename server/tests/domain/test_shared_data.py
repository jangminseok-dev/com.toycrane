import math
import json
from pathlib import Path

from toycrane.domain import catalog, layout, shared_data

SHARED = Path(__file__).resolve().parents[3] / "shared"


def test_generated_module_matches_shared_json():
    assert shared_data.CATALOG == json.loads((SHARED / "catalog.json").read_text(encoding="utf-8"))
    assert shared_data.LAYOUT == json.loads((SHARED / "store_layout.json").read_text(encoding="utf-8"))
    assert shared_data.CLAW == json.loads((SHARED / "claw.json").read_text(encoding="utf-8"))


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
    assert (a1.x, a1.z, a1.ry, a1.kind, a1.row) == (-20.2, -9.45, 1.570796, "bunny", "d1")  # 큰 홀: 서쪽 세 줄(d1·d2·d3), 광장을 봄
    assert (c1.kind, c1.row) == ("owl", "d2")  # 14번째 → 13 % 4 = 1(숲), 숲의 네 번째


def test_front_spot_is_in_front_of_the_machine():
    # 큰 홀(설계 2026-11-01): 인형 기계는 서쪽에서 동쪽(광장, ry=π/2)을 본다 — 앞자리는 기계에서 +x로 front만큼
    f = layout.front_spot(layout.MACHINES["A-1"])
    assert (round(f.x, 2), round(f.z, 2)) == (-19.05, -9.45)
    f = layout.front_spot(layout.MACHINES["C-1"])
    assert (round(f.x, 2), round(f.z, 2)) == (-15.25, 4.05)


def test_four_small_counters_spread_out():
    assert len(layout.COUNTERS) == 4
    spots = [(c.x, c.z) for c in layout.COUNTERS]
    for i, a in enumerate(spots):
        for b in spots[i + 1:]:
            assert math.hypot(a[0] - b[0], a[1] - b[1]) > 5  # 나란히 붙지 않음 (설계 2026-10-31 교환소 개편 §3.1)
    for c in layout.COUNTERS:
        assert c.ry == 0 and c.window.z > c.z  # 카메라 쪽(남쪽)을 보고, 창구는 그 앞


# Review Focus 4: 새 교환소가 길을 막지 않는다 — 창구가 장애물 안에 있지 않고 바닥 위다
def test_every_window_is_reachable_from_the_hub():
    from toycrane.domain.store_rules import clamp_to_floor
    for c in layout.COUNTERS:
        assert not any(x0 < c.window.x < x1 and z0 < c.window.z < z1 for x0, z0, x1, z1 in layout.OBSTACLES)
        assert clamp_to_floor(c.window) == c.window

# 9단계 피규어 뽑기: 동쪽 14대(F-1~F-14), 광장 쪽(−x)을 봄 — 화면과 같은 공용 배치
def test_figures_come_from_shared_layout():
    assert shared_data.FIGURE == json.loads((SHARED / "figure.json").read_text(encoding="utf-8"))
    from toycrane.domain.layout import FIGURES, front_spot, machine_spot

    assert len(FIGURES) == 14
    f1 = FIGURES["F-1"]
    assert (f1.x, f1.z, f1.ry, f1.row) == (13.2, -8.1, -1.570796, "f1")
    f = front_spot(f1)
    assert (round(f.x, 2), round(f.z, 2)) == (12.05, -8.1)
    assert machine_spot("F-14") is FIGURES["F-14"]
    assert machine_spot("C-6") is not None and machine_spot("X-1") is None

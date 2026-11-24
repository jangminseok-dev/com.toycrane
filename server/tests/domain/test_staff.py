import math

from toycrane.domain.layout import FIGURES, MACHINES, PUSHERS, RINGS, front_spot, machine_spot
from toycrane.domain.shared_data import LAYOUT, STAFF
from toycrane.domain.staff import side_spot, walk_seconds, zone_of


def _free(x: float, z: float, margin: float = 0.2) -> bool:
    return not any(x0 - margin < x < x1 + margin and z0 - margin < z < z1 + margin for x0, z0, x1, z1 in LAYOUT["obstacles"])


# 상주 직원(설계 2026-11-24): 기계마다 구역이 하나, 직원은 기계 앞자리에서 손님 기준 왼쪽으로 side m 비켜서서 일한다(장애물 밖)
def test_every_machine_has_a_zone_and_a_side_spot():
    zones = {**{m: "doll" for m in MACHINES}, **{m: "figure" for m in FIGURES}, **{m: "hook" for m in RINGS}, **{m: "pusher" for m in PUSHERS}}
    for m, zone in zones.items():
        assert zone_of(m) == zone
        f, (x, z) = front_spot(machine_spot(m)), side_spot(m)
        assert math.isclose(math.hypot(x - f.x, z - f.z), STAFF["side"], abs_tol=1e-9)
        assert _free(x, z), m
    assert zone_of("X-1") is None


def test_side_spot_is_on_the_players_left():
    """A-1(ry π/2, +x를 봄)의 앞자리에서 기계를 보면 왼쪽은 −z가 아니라 +z — 화면 왼쪽 끝."""
    f, (x, z) = front_spot(MACHINES["A-1"]), side_spot("A-1")
    assert math.isclose(x, f.x, abs_tol=1e-6) and math.isclose(z, f.z + STAFF["side"], abs_tol=1e-6)  # ry는 π/2를 소수 여섯째 자리까지


def test_walk_seconds_is_clamped():
    assert walk_seconds((0.0, 0.0), (0.0, 0.0)) == STAFF["walk_min"]
    assert walk_seconds((0.0, 0.0), (100.0, 0.0)) == STAFF["walk_max"]
    assert math.isclose(walk_seconds((0.0, 0.0), (6.0, 8.0)), 10 * STAFF["route_factor"] / STAFF["speed"])


def test_side_spots_match_the_screen():
    """화면 data/staff.test.ts와 같은 숫자 — 서버와 화면이 같은 자리에 직원을 세운다."""
    expect = {"A-1": (-16.05, -8.55), "F-1": (9.05, -9.0), "R-1": (-12.3, -16.85), "P-1": (-5.1, -12.45)}
    for m, (x, z) in expect.items():
        sx, sz = side_spot(m)
        assert math.isclose(sx, x, abs_tol=1e-3) and math.isclose(sz, z, abs_tol=1e-3), m

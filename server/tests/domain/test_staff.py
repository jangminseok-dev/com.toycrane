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
        assert math.isclose(math.hypot(x - f.x, z - f.z), math.hypot(STAFF["side"][zone], STAFF["inset"]), abs_tol=1e-9)
        assert _free(x, z), m
    assert zone_of("X-1") is None


def test_side_spot_is_on_the_players_left():
    """A-1(ry π/2, +x를 봄)의 앞자리에서 기계를 보면 왼쪽은 +z, 기계 쪽은 −x — 기계 앞면 바로 옆."""
    f, (x, z) = front_spot(MACHINES["A-1"]), side_spot("A-1")
    assert math.isclose(x, f.x - STAFF["inset"], abs_tol=1e-6) and math.isclose(z, f.z + STAFF["side"]["doll"], abs_tol=1e-6)  # ry는 π/2를 소수 여섯째 자리까지


def test_walk_seconds_is_clamped():
    assert walk_seconds((0.0, 0.0), (0.0, 0.0)) == STAFF["walk_min"]
    assert walk_seconds((0.0, 0.0), (100.0, 0.0)) == STAFF["walk_max"]
    assert math.isclose(walk_seconds((0.0, 0.0), (6.0, 8.0)), 10 * STAFF["route_factor"] / STAFF["speed"])


def test_side_spots_match_the_screen():
    """화면 data/staff.test.ts와 같은 숫자 — 서버와 화면이 같은 자리에 직원을 세운다."""
    expect = {"A-1": (-16.65, -8.3), "F-1": (9.65, -9.25), "R-1": (-12.45, -17.45), "P-1": (-5.35, -13.05)}
    for m, (x, z) in expect.items():
        sx, sz = side_spot(m)
        assert math.isclose(sx, x, abs_tol=1e-3) and math.isclose(sz, z, abs_tol=1e-3), m


# --- 일정·줄·5판 세기 (작업 2) ---
from toycrane.domain.staff import EMPTY_BOARD, back_at, calls_left, count_play, pending, plan_call, post_of, prune  # noqa: E402

W, B, EVERY, QMAX = STAFF["work"], STAFF["bow"], STAFF["calls_every"], STAFF["queue_max"]


def test_first_call_walks_from_the_post_now():
    board, job = plan_call(EMPTY_BOARD, "A-1", "g1", 100.0)
    assert job.machine == "A-1" and job.origin is None and job.depart == 100.0
    assert math.isclose(job.arrive, 100.0 + walk_seconds(post_of("doll"), side_spot("A-1")))
    assert math.isclose(job.put, job.arrive + W) and math.isclose(job.end, job.put + B)
    assert board.jobs["doll"] == (job,) and board.calls == {"A-1": {"g1": 0}}


def test_a_second_call_in_the_zone_starts_when_the_first_ends_from_its_side():
    board, first = plan_call(EMPTY_BOARD, "A-1", "g1", 100.0)
    board, second = plan_call(board, "A-5", "g2", 101.0)
    assert second.origin == "A-1" and second.depart == first.end
    assert math.isclose(second.arrive, first.end + walk_seconds(side_spot("A-1"), side_spot("A-5")))
    assert board.jobs["doll"] == (first, second)


def test_other_zones_have_their_own_staff():
    board, _ = plan_call(EMPTY_BOARD, "A-1", "g1", 100.0)
    board, job = plan_call(board, "F-1", "g2", 100.0)
    assert job.origin is None and job.depart == 100.0 and set(board.jobs) == {"doll", "figure"}


def test_the_queue_holds_two_waiting_jobs():
    board, _ = plan_call(EMPTY_BOARD, "A-1", "g1", 100.0)
    for i, m in enumerate(["A-2", "A-3"][:QMAX]):
        board, _ = plan_call(board, m, f"g{i + 2}", 100.5)
    assert plan_call(board, "A-4", "g9", 100.6) == "busy"


def test_calls_every_five_plays():
    board, job = plan_call(EMPTY_BOARD, "A-1", "g1", 100.0)
    later = job.end + 100
    board = prune(board, later)
    for _ in range(EVERY - 1):
        board = count_play(board, "A-1", "g1")
    assert plan_call(board, "A-1", "g1", later) == "wait" and calls_left(board, "A-1", "g1") == 1
    board = count_play(board, "A-1", "g1")
    assert calls_left(board, "A-1", "g1") == 0 and not isinstance(plan_call(board, "A-1", "g1", later), str)
    assert count_play(EMPTY_BOARD, "A-1", "g2") == EMPTY_BOARD  # 부른 적 없는 손님은 세지 않는다(처음엔 바로 부를 수 있다)


def test_a_machine_with_an_unfinished_job_refuses_another_call():
    board, _ = plan_call(EMPTY_BOARD, "A-1", "g1", 100.0)
    assert plan_call(board, "A-1", "g2", 101.0) == "again"


def test_a_call_while_the_staff_walks_back_leaves_from_the_post_after_arriving():
    board, job = plan_call(EMPTY_BOARD, "A-1", "g1", 100.0)
    returning, back = job.end + 0.1, back_at(board.jobs["doll"], "doll")
    board, nxt = plan_call(board, "A-9", "g2", returning)
    assert nxt.origin is None and math.isclose(nxt.depart, back) and board.jobs["doll"] == (job, nxt)  # 앞 일을 남겨 돌아오는 걸음이 이어진다


def test_prune_drops_jobs_after_the_walk_back():
    board, job = plan_call(EMPTY_BOARD, "A-1", "g1", 100.0)
    back = back_at(board.jobs["doll"], "doll")
    assert prune(board, back - 0.01).jobs == board.jobs
    assert prune(board, back + 0.01).jobs == {} and prune(board, back + 0.01).calls == board.calls


def test_pending_is_until_put():
    board, job = plan_call(EMPTY_BOARD, "A-1", "g1", 100.0)
    assert pending(board, "A-1", job.put - 0.01) == job
    assert pending(board, "A-1", job.put) is None and pending(board, "A-2", 100.0) is None

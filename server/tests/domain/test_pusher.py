"""미는 뽑기 규칙(설계 2026-11-02 §4): 선반 위 미니 인형(원판)을 미는 판이 앞으로 밀고, 밀린 인형이 다른 인형을 밀며, 앞 끝을 넘으면 떨어진다."""

import math
import random
from statistics import median

from toycrane.domain.pusher import Item, drop_in, new_shelf, plate_range, push, valid_push
from toycrane.domain.shared_data import PUSHER

S, P, R = PUSHER["shelf"], PUSHER["plate"], PUSHER["item"]["r"]


def item(uid: int, x: float, z: float) -> Item:
    return Item(uid, "bear", 0, "", x, z)


def overlaps(items) -> float:
    return max((2 * R - math.dist((a.x, a.z), (b.x, b.z)) for i, a in enumerate(items) for b in items[i + 1:]), default=0.0)


def test_new_shelf_spreads_items_without_overlap():
    shelf = new_shelf(random.Random(1))
    assert len(shelf) == PUSHER["item"]["count"] and len({i.uid for i in shelf}) == len(shelf)
    assert overlaps(shelf) <= 1e-9
    for i in shelf:
        assert abs(i.x) <= S["half_w"] - R + 1e-9 and S["back_z"] + R - 1e-9 <= i.z <= S["front_z"] - R - PUSHER["item"]["start_margin"] + 1e-9


def test_push_moves_items_in_front_of_the_plate():
    after, fell = push((item(1, 0.0, -0.18), item(2, 0.3, -0.18)), 0.0)
    a = {i.uid: i for i in after}
    assert fell == () and math.isclose(a[1].z, S["back_z"] + P["stroke"] + R, abs_tol=1e-6)
    assert a[2] == item(2, 0.3, -0.18)  # 판 옆은 그대로


def test_items_past_the_front_edge_fall():
    column = tuple(item(k, 0.0, -0.17 + k * 2 * R) for k in range(6))  # 맞닿은 사슬이 앞 끝까지
    after, fell = push(column, 0.0)
    gone = {i.uid for i in fell}
    assert gone and gone == set(range(min(gone), 6))  # 사슬의 맨 앞부터 연달아 떨어진다
    assert all(i.z <= S["front_z"] for i in after)


def test_same_push_gives_the_same_shelf():
    shelf = new_shelf(random.Random(4))
    assert push(shelf, 0.05) == push(shelf, 0.05)


def test_items_stay_inside_the_side_and_back_walls():
    rng = random.Random(5)
    for _ in range(100):
        shelf = new_shelf(rng)
        for _ in range(5):
            shelf, _ = push(drop_in(shelf, rng), rng.uniform(*plate_range()))
            for i in shelf:
                assert abs(i.x) <= S["half_w"] - R + 1e-9 and i.z >= S["back_z"] + R - 1e-9


def test_overlap_relaxation_always_ends():
    rng = random.Random(6)
    crowd = tuple(item(k, rng.uniform(-0.3, 0.3), rng.uniform(-0.2, 0.2)) for k in range(40))  # 겹쳐 놓은 무더기
    after, _ = push(crowd, 0.0)
    assert len(after) <= len(crowd)


def test_each_play_drops_one_new_item_at_the_back_up_to_the_cap():
    rng = random.Random(7)
    shelf = new_shelf(rng)
    more = drop_in(shelf, rng)
    new = [i for i in more if i.uid not in {f.uid for f in shelf}]
    assert len(more) == len(shelf) + 1 and len(new) == 1 and new[0].z <= S["back_z"] + 0.14 and overlaps(more) <= 1e-9
    full = tuple(item(k, -0.36 + (k % 10) * 0.08, -0.2 + (k // 10) * 0.2) for k in range(PUSHER["item"]["cap"]))
    assert drop_in(full, rng) == full


def test_valid_push_rejects_nan_and_out_of_range():
    lo, hi = plate_range()
    assert valid_push(0.0) and valid_push(lo) and valid_push(hi)
    assert not valid_push(math.nan) and not valid_push(hi + 0.05)


def test_a_careful_player_needs_about_4_to_6_plays():
    """미는 판이 오가는 중 맨 앞 인형 줄을 노려 누르는 사람(타이밍 오차 ±3cm) — 200명의 판수 50%선이 4~6판, 90%선 12판 안."""
    rng, plays = random.Random(8), []
    lo, hi = plate_range()
    for _ in range(200):
        shelf = new_shelf(rng)
        for n in range(1, 60):
            shelf = drop_in(shelf, rng)
            target = max(shelf, key=lambda i: i.z).x
            shelf, fell = push(shelf, min(hi, max(lo, target + rng.uniform(-0.03, 0.03))))
            if fell:
                plays.append(n)
                break
        else:
            plays.append(99)
    plays.sort()
    assert 4 <= median(plays) <= 6 and plays[len(plays) * 9 // 10] <= 12

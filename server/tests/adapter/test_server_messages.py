import json
from pathlib import Path

from toycrane.adapter.inbound.ws.schemas.server_messages import (
    bag, coins, correct, done_no, figure, free, join, leave, machine, move, play, play_no, play_ok, pose, result, spawn, stock, take_no, cbeg, cbeg_no, beg, gave, give_no, welcome,
)
from toycrane.app.dtos.player_view import PlayerView
from toycrane.app.dtos.store_snapshot import StoreSnapshot
from toycrane.domain.crane import DollSpot

FX = json.loads((Path(__file__).resolve().parents[3] / "shared" / "protocol_fixtures.json").read_text(encoding="utf-8"))


def view(d: dict) -> PlayerView:
    return PlayerView(**d)


def test_welcome_matches_fixture():
    fx = FX["server_welcome"]
    snap = StoreSnapshot(
        coins=5, bag=2,
        machines={"A-1": [DollSpot("bunny", 0.1204, 0.87, -0.0501, (0, 0, 0, 1), 2, "n", 1, "", 1), DollSpot("bunny", -0.2, None, 0.1, (0, 0, 0, 1), 0, "c", 3, "star", 2)]},
        plays={"A-3": "p2"},
        figures={"F-1": (0.0041, 1.0543, -0.0031, 0.0, 0.0123, 0.0, 1.0)},
    )
    assert welcome(fx["store"], view(fx["you"]), [view(p) for p in fx["players"]], snap) == fx


def test_join_matches_fixture():
    assert join(view(FX["server_join"]["p"])) == FX["server_join"]


def test_move_matches_fixture():
    fx = FX["server_move"]
    assert move(PlayerView(fx["id"], "곰돌이", 5, fx["x"], fx["z"], fx["dx"], fx["dz"])) == fx


def test_correct_and_leave_match_fixtures():
    assert correct(1.6, 3.0) == FX["server_correct"]
    assert leave("p2") == FX["server_leave"]


def test_positions_are_rounded_for_the_wire():
    assert move(PlayerView("p2", "곰돌이", 5, 1.60004, 2.99996, 0.70712, -0.70712)) == {
        "t": "move", "id": "p2", "x": 1.6, "z": 3.0, "dx": 0.707, "dz": -0.707,
    }


def test_counter_and_coin_messages_match_fixtures():
    assert take_no(0, "enough") == FX["server_take_no"]
    assert cbeg("p1", 0, 37) == FX["server_cbeg"]
    assert cbeg_no(0, "wait", 299.2) == FX["server_cbeg_no"]  # 남은 초는 올림
    assert coins(10, 5) == FX["server_coins"]


def test_play_messages_match_fixtures():
    assert play_ok("A-3", 9, 20) == FX["server_play_ok"]
    assert play_no("A-3", "busy") == FX["server_play_no"]
    assert play("A-3", "p1") == FX["server_play"]
    assert result("A-3", "p1", [("bunny", 2, "", 7)]) == FX["server_result"]
    assert result("P-1", "p1", [("bunny", 2, "", 7)], staff=True) == FX["server_result_staff"]  # 미는 뽑기 15판 보장(직원이 꺼내 줌)
    assert result("A-3", "p1", [], miss=3) == FX["server_result_miss"]  # 연달아 못 뽑은 판 수(있을 때만)
    assert result("P-1", "p1", [], miss=2, tidied=1) == FX["server_result_tidy"]  # 직원이 정리한 인형 수(있을 때만)
    assert machine("A-3", [DollSpot("bear", 0.2, 0.87, 0.1, (0, 0, 0, 1), 3, "s", 4, "", 7), DollSpot("bear", -0.1, None, 0.3, (0, 0, 0, 1), 1, "n", 0, "", 8)]) == FX["server_machine"]


# 기계 속 인형 한 칸 = [캐릭터, x, y|null, z, qx, qy, qz, qw, 색, 체형, 표정, 희귀, 번호] — 자리 소수 3자리, 돌림 3자리 (물리 뽑기 설계 §4.5)
def test_machine_message_rounds_pose_and_sends_unsettled_as_null():
    msg = machine("A-1", [DollSpot("bear", 0.10004, 0.87, 0.2, (0.0004, 0.70711, 0, 0.70711), 3, "c", 2, "star", 7), DollSpot("bear", 0.3, None, 0.3, (0, 0, 0, 1), 0, "n", 0, "", 8)])
    assert msg["dolls"] == [["bear", 0.1, 0.87, 0.2, 0.0, 0.707, 0.0, 0.707, 3, "c", 2, "star", 7], ["bear", 0.3, None, 0.3, 0, 0, 0, 1, 0, "n", 0, "", 8]]


def test_done_no_pose_free_and_bag_match_fixtures():
    assert done_no("A-3", "count") == FX["server_done_no"]
    fx = FX["server_pose"]
    assert pose("p1", "A-3", fx["f"]) == fx  # 0.4초 묶음(2026-11-02)
    assert result("A-3", "p1", []) == {"t": "result", "m": "A-3", "id": "p1", "won": []}
    assert free("A-3") == FX["server_free"] and bag(3) == FX["server_bag"]


def test_stock_messages_match_fixtures():
    assert spawn("B-3", "bear", "gold") == FX["server_spawn"]
    assert stock(12.5) == FX["server_stock"]
    assert stock(None) == {"t": "stock", "in": None}


# 남은 초는 0.1초 단위로 올린다 — 내리면 화면의 tick이 채울 시각보다 먼저 도착해 아무도 안 움직이는 매장이 멈춘다 (최종 리뷰 M1)
def test_stock_time_rounds_up():
    assert stock(12.54)["in"] == 12.6 and stock(12.5)["in"] == 12.5 and stock(0.01)["in"] == 0.1



def test_begging_and_giving_messages_match_fixtures():
    assert beg("p2", 94) == FX["server_beg"] and beg("p2", None) == {"t": "beg", "id": "p2", "room": None}
    assert gave("p1", "p2", 3) == FX["server_gave"]
    assert give_no("stopped") == FX["server_give_no"]


def test_give_schema_takes_an_id_and_one_to_ninety_nine():
    from toycrane.adapter.inbound.ws.schemas.give_schema import parse
    assert parse(FX["client_give"]) == ("p2", 3)
    for bad in ({"to": "p2", "n": 0}, {"to": "p2", "n": 100}, {"to": "p2", "n": True}, {"to": "p2", "n": "3"}, {"to": 5, "n": 3}, {"to": "", "n": 3}):
        assert parse(bad) is None


def test_figure_matches_fixture():
    assert figure("F-1", (0.0041, 1.0324, -0.0031, 0.0, 0.0123, 0.0, 1.0), False) == FX["server_figure"]


def test_protocol_is_thirteen():
    """고리 걸기·미는 뽑기 다시 만들기(설계 2026-11-02 ring-hook): act·ring·pusher 메시지와 welcome rings·pushers를 없애 옛 화면은 새로 고친다 — 화면(net/protocol.ts)과 같은 수."""
    from toycrane.adapter.inbound.ws.schemas.server_messages import PROTOCOL

    assert PROTOCOL == 17  # 직원 부르기 staff·staffed(2026-11-24) — 옛 화면이 새로 고쳐 버튼을 받게  # 고리 기계 간격 2.1m(2026-11-03) — 장애물이 바뀌어 옛 화면이 새로 고치게  # 매장 38m·진열탑·피규어 앞 벽 — 배치가 바뀌면 옛 화면이 새로 고치게(2026-11-02)


def test_staffed_tells_how_many_dolls_the_staff_moved():
    from toycrane.adapter.inbound.ws.schemas.server_messages import staffed

    assert staffed("A-1", 2) == {"t": "staffed", "m": "A-1", "n": 2}

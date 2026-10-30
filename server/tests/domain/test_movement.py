from toycrane.domain.movement import accept_move
from toycrane.domain.value_objects.heading import Heading
from toycrane.domain.value_objects.position import Position


def test_within_speed_is_accepted():
    assert accept_move(Position(0, 3), Heading(1, 0), 0.0, Position(1.5, 3), now=0.5) == Position(1.5, 3)


def test_teleport_snaps_to_expected():
    assert accept_move(Position(0, 3), Heading(1, 0), 0.0, Position(9, 3), now=0.5) == Position(1.6, 3)


def test_clamped_to_floor_edge():
    assert accept_move(Position(12.5, 0), Heading(1, 0), 0.0, Position(12.9, 0), now=0.5) == Position(12.6, 0)


def test_pushed_out_of_tower():
    assert accept_move(Position(0.5, 1.5), Heading(0, -1), 0.0, Position(0.5, 1.0), now=0.2) == Position(0.5, 1.3)

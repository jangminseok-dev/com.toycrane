from toycrane.adapter.inbound.http.schemas.guest_schema import parse_create, to_json
from toycrane.app.dtos.guest_dto import CreateGuestCommand, GuestView


def test_parse_create_reads_nickname():
    assert parse_create({"nickname": "토끼"}) == CreateGuestCommand("토끼")


def test_parse_create_missing_or_wrong_type_is_none():
    assert parse_create({}) is None
    assert parse_create({"nickname": 5}) is None


def test_to_json_uses_client_field_names():
    assert to_json(GuestView("g-1", "토끼", 3)) == {"guestId": "g-1", "nickname": "토끼", "color": 3}

from toycrane.app.dtos.guest_dto import CreateGuestCommand, GuestView


def parse_create(body: dict) -> CreateGuestCommand | None:
    nickname = body.get("nickname")
    return CreateGuestCommand(nickname) if isinstance(nickname, str) else None


def to_json(view: GuestView) -> dict:
    return {"guestId": view.guest_id, "nickname": view.nickname, "color": view.color}

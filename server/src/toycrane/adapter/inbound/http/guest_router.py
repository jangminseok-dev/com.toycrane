from toycrane.adapter.inbound.http.schemas.guest_schema import parse_create, to_json
from toycrane.adapter.runtime import json_response, path_of, read_json
from toycrane.app.dtos.guest_dto import FindGuestQuery
from toycrane.dependencies.guest_provider import get_guest_use_case
from toycrane.domain.nickname import InvalidNickname

PREFIX = "/api/guest"


async def introduce(request, env):
    return json_response({
        "name": "게스트",
        "description": (
            "로그인 없이 닉네임만으로 게스트를 만들고, 같은 브라우저가 다시 오면 되찾습니다. "
            "닉네임은 1~10자, 아바타 색은 8색 중 하나가 자동으로 정해집니다."
        ),
        "endpoints": [
            "GET /api/guest/myself — 이 소개",
            "POST /api/guest — 만들기 {nickname} → 201 {guestId, nickname, color} / 400 {error: nickname}",
            "GET /api/guest/{id} — 되찾기 → 200 / 404",
        ],
    })


async def create(request, env):
    body = await read_json(request)
    cmd = parse_create(body) if body is not None else None
    if cmd is None:
        return json_response({"error": "nickname"}, status=400)
    try:
        view = await get_guest_use_case(env).create(cmd)
    except InvalidNickname:
        return json_response({"error": "nickname"}, status=400)
    return json_response(to_json(view), status=201)


async def find(request, env):
    guest_id = path_of(request).removeprefix(PREFIX + "/")
    view = await get_guest_use_case(env).find(FindGuestQuery(guest_id))
    if view is None:
        return json_response({"error": "guest"}, status=404)
    return json_response(to_json(view))

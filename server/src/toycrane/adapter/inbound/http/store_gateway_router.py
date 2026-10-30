"""매장 웹소켓 관문: /ws/store/{n}?guest={id} → 게스트 확인 후 매장 DO(store-{n})로 넘긴다."""

from urllib.parse import quote

from toycrane.adapter.runtime import json_response, path_of, query_param, reject_websocket, with_headers
from toycrane.app.dtos.guest_dto import FindGuestQuery
from toycrane.dependencies.guest_provider import get_guest_use_case

PREFIX = "/ws/store/"
UNKNOWN_GUEST = 4002


async def open_store(request, env):
    raw_no = path_of(request).removeprefix(PREFIX)
    if not raw_no.isdigit() or not 1 <= int(raw_no) <= int(env.MAX_STORES):
        return json_response({"error": "store"}, status=404)
    if request.headers.get("Upgrade") != "websocket":
        return json_response({"error": "websocket"}, status=426)
    guest_id = query_param(request, "guest")
    guest = await get_guest_use_case(env).find(FindGuestQuery(guest_id)) if guest_id else None
    if guest is None:
        return reject_websocket(UNKNOWN_GUEST, "unknown guest")
    store_no = int(raw_no)
    stub = env.STORE.getByName(f"store-{store_no}")
    return await stub.fetch(with_headers(request, {
        "X-Guest-Id": guest.guest_id,
        "X-Nickname": quote(guest.nickname),
        "X-Color": str(guest.color),
        "X-Store-No": str(store_no),
    }))

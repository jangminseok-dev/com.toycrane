from toycrane.adapter.inbound.http.schemas.bag_schema import to_json
from toycrane.adapter.runtime import json_response, path_of
from toycrane.app.dtos.bag_dto import ListBagQuery
from toycrane.dependencies.bag_provider import get_bag_use_case

PREFIX = "/api/bag"


async def list_bag(request, env):
    """GET /api/bag/{guestId} — 뽑은 것 목록 {items: [{doll, color, rare, zone, count, first_at}]}, 처음 뽑은 때가 늦은 것부터."""
    guest_id = path_of(request).removeprefix(PREFIX + "/")
    return json_response(to_json(await get_bag_use_case(env).list(ListBagQuery(guest_id))))

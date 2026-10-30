from toycrane.adapter.inbound.http.schemas.admission_schema import parse_admit, to_json
from toycrane.adapter.runtime import json_response, read_json
from toycrane.app.dtos.admission_dto import UnknownGuest
from toycrane.dependencies.admission_provider import get_admission_use_case


async def introduce(request, env):
    return json_response({
        "name": "매장 배정",
        "description": (
            "자리가 있는 가장 작은 번호의 매장을 정해 줍니다. 매장 하나에 50명, 최대 매장 수는 MAX_STORES"
            f"({env.MAX_STORES})이고, 모두 차면 만석으로 알려 줍니다."
        ),
        "endpoints": [
            "GET /api/admission/myself — 이 소개",
            "POST /api/admission — 배정 {guestId} → 200 {store} 또는 {full: true} / 404 {error: guest}",
        ],
    })


async def admit(request, env):
    body = await read_json(request)
    query = parse_admit(body) if body is not None else None
    if query is None:
        return json_response({"error": "body"}, status=400)
    try:
        result = await get_admission_use_case(env).admit(query)
    except UnknownGuest:
        return json_response({"error": "guest"}, status=404)
    return json_response(to_json(result))

"""HTTP 요청을 (메서드, 경로) 표로 슬라이스별 라우터에 넘긴다."""

from toycrane.adapter.inbound.http import manager_router
from toycrane.adapter.runtime import json_response, path_of

ROUTES = {
    ("GET", "/api/myself"): manager_router.introduce,
}


async def route(request, env):
    handler = ROUTES.get((request.method, path_of(request)))
    if handler is None:
        return json_response({"error": "not_found"}, status=404)
    return await handler(request, env)

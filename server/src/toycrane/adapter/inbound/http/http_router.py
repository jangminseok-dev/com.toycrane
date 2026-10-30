"""HTTP 요청을 (메서드, 경로) 표로 슬라이스별 라우터에 넘긴다. 정확한 경로가 먼저, 그다음 접두사."""

from toycrane.adapter.inbound.http import admission_router, guest_router, manager_router, store_gateway_router
from toycrane.adapter.runtime import json_response, path_of

ROUTES = {
    ("GET", "/api/myself"): manager_router.introduce,
    ("GET", "/api/guest/myself"): guest_router.introduce,
    ("POST", "/api/guest"): guest_router.create,
    ("GET", "/api/admission/myself"): admission_router.introduce,
    ("POST", "/api/admission"): admission_router.admit,
}

PREFIX_ROUTES = [
    ("GET", guest_router.PREFIX + "/", guest_router.find),
    ("GET", store_gateway_router.PREFIX, store_gateway_router.open_store),
]


async def route(request, env):
    method, path = request.method, path_of(request)
    handler = ROUTES.get((method, path))
    if handler is None:
        handler = next((h for m, prefix, h in PREFIX_ROUTES if m == method and path.startswith(prefix)), None)
    if handler is None:
        return json_response({"error": "not_found"}, status=404)
    return await handler(request, env)

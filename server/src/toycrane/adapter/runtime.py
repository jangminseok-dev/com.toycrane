"""Workers 런타임(Request·Response·JsProxy)과 맞닿는 곳. 런타임 import는 여기와 DO·진입점에만 둔다."""

from urllib.parse import parse_qs, urlparse

import js
from workers import Response

from toycrane.adapter.outbound.js_values import to_py  # noqa: F401 — 기존 어댑터들이 여기서 가져다 쓴다


async def read_json(request) -> dict | None:
    try:
        data = await request.json()
    except Exception:
        return None
    return data if isinstance(data, dict) else None


def json_response(data: dict, status: int = 200) -> Response:
    return Response.from_json(data, status=status)


def path_of(request) -> str:
    return urlparse(request.url).path


def query_param(request, name: str) -> str | None:
    values = parse_qs(urlparse(request.url).query).get(name)
    return values[0] if values else None


def with_headers(request, extra: dict[str, str]):
    """원래 요청(웹소켓 Upgrade 포함)에 헤더를 더한 JS Request — DO로 넘길 때 쓴다."""
    headers = js.Headers.new(request.js_object.headers)
    for key, value in extra.items():
        headers.set(key, value)
    return js.Request.new(request.js_object, headers=headers)


def reject_websocket(code: int, reason: str) -> Response:
    """웹소켓을 받자마자 닫기 코드로 닫는다 — 화면이 HTTP 오류 대신 이유(코드)를 알 수 있게."""
    client, server = js.WebSocketPair.new().object_values()
    server.accept()
    server.close(code, reason)
    return Response(None, status=101, web_socket=client)

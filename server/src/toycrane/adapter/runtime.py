"""Workers 런타임(Request·Response·JsProxy)과 맞닿는 곳. 런타임 import는 여기와 DO·진입점에만 둔다."""

from urllib.parse import parse_qs, urlparse

from workers import Response


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


def to_py(value):
    return value.to_py() if hasattr(value, "to_py") else value

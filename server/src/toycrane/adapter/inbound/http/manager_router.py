from toycrane.adapter.inbound.http.schemas.manager_schema import to_json
from toycrane.adapter.runtime import json_response
from toycrane.app.dtos.manager_dto import ManagerQuery
from toycrane.dependencies.manager_provider import get_manager_use_case


async def introduce(request, env):
    result = await get_manager_use_case(env).introduce_myself(ManagerQuery(name="toycrane 매장 서버"))
    return json_response(to_json(result))

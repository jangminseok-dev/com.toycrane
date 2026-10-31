"""give 메시지(give 슬라이스의 인바운드 어댑터): 조르는 사람에게 코인 주기."""

import time

from toycrane.adapter.inbound.ws.schemas.give_schema import parse
from toycrane.adapter.outbound import ws_attachment
from toycrane.app.dtos.give_dto import GiveCommand
from toycrane.dependencies.give_provider import get_give_use_case


async def handle(ctx, env, ws, data: dict) -> None:
    conn_id = ws_attachment.read(ws).get("conn")
    parsed = parse(data)
    if conn_id and parsed is not None:
        await get_give_use_case(ctx, env).give(GiveCommand(conn_id, parsed[0], parsed[1], time.time()))

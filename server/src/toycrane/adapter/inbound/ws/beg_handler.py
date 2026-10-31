"""beg 메시지(beg 슬라이스의 인바운드 어댑터): 맵에서 조르기 켜고 끄기."""

import time

from toycrane.adapter.inbound.ws.schemas.beg_schema import parse
from toycrane.adapter.outbound import ws_attachment
from toycrane.app.dtos.beg_dto import BegCommand
from toycrane.dependencies.beg_provider import get_beg_use_case


async def handle(ctx, env, ws, data: dict) -> None:
    conn_id = ws_attachment.read(ws).get("conn")
    on = parse(data)
    if conn_id and on is not None:
        await get_beg_use_case(ctx, env).beg(BegCommand(conn_id, on, time.time()))

"""move 메시지(move 슬라이스의 인바운드 어댑터)."""

import time

from toycrane.adapter.inbound.ws.schemas.move_schema import parse
from toycrane.adapter.outbound import ws_attachment
from toycrane.dependencies.move_provider import get_move_use_case


async def handle(ctx, env, ws, data: dict) -> None:
    conn_id = ws_attachment.read(ws).get("conn")
    cmd = parse(data, conn_id, time.time()) if conn_id else None
    if cmd is not None:
        await get_move_use_case(ctx, env).move(cmd)

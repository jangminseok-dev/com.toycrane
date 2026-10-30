"""drop 메시지(drop 슬라이스의 인바운드 어댑터)."""

import time

from toycrane.adapter.inbound.ws.schemas.drop_schema import parse
from toycrane.adapter.outbound import ws_attachment
from toycrane.app.dtos.drop_dto import DropCommand
from toycrane.dependencies.drop_provider import get_drop_use_case


async def handle(ctx, env, ws, data: dict) -> None:
    conn_id = ws_attachment.read(ws).get("conn")
    claw = parse(data)
    if conn_id and claw:
        await get_drop_use_case(ctx, env).drop(DropCommand(conn_id, claw[0], claw[1], time.time()))

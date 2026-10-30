"""play 메시지(play_start 슬라이스의 인바운드 어댑터)."""

import time

from toycrane.adapter.inbound.ws.schemas.play_schema import parse
from toycrane.adapter.outbound import ws_attachment
from toycrane.app.dtos.play_dto import PlayStartCommand
from toycrane.dependencies.play_start_provider import get_play_start_use_case


async def handle(ctx, env, ws, data: dict) -> None:
    conn_id = ws_attachment.read(ws).get("conn")
    machine_id = parse(data)
    if conn_id and machine_id:
        await get_play_start_use_case(ctx, env).start(PlayStartCommand(conn_id, machine_id, time.time()))

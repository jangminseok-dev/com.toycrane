"""pose 메시지(pose 슬라이스의 인바운드 어댑터)."""

import time

from toycrane.adapter.inbound.ws.schemas.pose_schema import parse
from toycrane.adapter.outbound import ws_attachment
from toycrane.app.dtos.pose_dto import PoseCommand
from toycrane.dependencies.pose_provider import get_pose_use_case


async def handle(ctx, env, ws, data: dict) -> None:
    conn_id = ws_attachment.read(ws).get("conn")
    parsed = parse(data)
    if conn_id and parsed:
        await get_pose_use_case(ctx, env).relay(PoseCommand(conn_id, parsed[0], parsed[1], parsed[2], time.time()))

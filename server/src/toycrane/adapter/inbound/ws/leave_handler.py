"""매장 웹소켓이 닫힐 때(leave 슬라이스의 인바운드 어댑터)."""

import time

from toycrane.adapter.outbound import ws_attachment
from toycrane.app.dtos.leave_dto import LeaveCommand
from toycrane.dependencies.leave_provider import get_leave_use_case


async def handle(ctx, env, ws) -> None:
    data = ws_attachment.read(ws)
    if "conn" not in data:
        return
    await get_leave_use_case(ctx, env).leave(LeaveCommand(data["conn"], int(data.get("store", 0)), time.time()))

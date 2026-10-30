"""매장 웹소켓이 열릴 때(enter 슬라이스의 인바운드 어댑터). 관문 라우터가 붙인 헤더로 명령을 만든다."""

import random
import time
import uuid
from urllib.parse import unquote

from toycrane.adapter.outbound import ws_attachment
from toycrane.app.dtos.enter_dto import EnterCommand, StoreFull
from toycrane.dependencies.enter_provider import get_enter_use_case

STORE_FULL = 4001


async def handle(ctx, env, server, request) -> None:
    store_no = int(request.headers.get("X-Store-No"))
    conn_id = uuid.uuid4().hex
    ws_attachment.write(server, {"conn": conn_id, "store": store_no})
    cmd = EnterCommand(
        conn_id=conn_id,
        guest_id=request.headers.get("X-Guest-Id"),
        nickname=unquote(request.headers.get("X-Nickname")),
        color=int(request.headers.get("X-Color")),
        store_no=store_no,
        now=time.time(),
        seed=random.randrange(1_000_000),
    )
    try:
        await get_enter_use_case(ctx, env).enter(cmd)
    except StoreFull:
        server.close(STORE_FULL, "full")

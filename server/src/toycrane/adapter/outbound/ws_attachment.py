"""웹소켓 attachment 읽기·쓰기. 접속마다 {"conn", "store", "player"}를 JSON으로 붙여 둔다(잠들었다 깨도 남음, 16KB 이하)."""

import json


def read(ws) -> dict:
    raw = ws.deserializeAttachment()
    return json.loads(raw) if raw else {}


def write(ws, data: dict) -> None:
    ws.serializeAttachment(json.dumps(data, ensure_ascii=False))


def sockets(ctx) -> list:
    return list(ctx.getWebSockets())


def find(ctx, conn_id: str):
    return next((ws for ws in sockets(ctx) if read(ws).get("conn") == conn_id), None)

# 버리는 시험 코드: 파이썬 Durable Object가 웹소켓 hibernation으로 동작하는지 확인
# 확인 방법: 잠들었다 깨면 인스턴스가 새로 만들어져 inst/born/handled가 바뀌는데, 접속(conns)은 유지돼야 함
import time

from js import WebSocketPair
from workers import DurableObject, Response, WorkerEntrypoint

BOOT = {"count": 0}


class Default(WorkerEntrypoint):
    async def fetch(self, request):
        if request.headers.get("Upgrade") == "websocket":
            stub = self.env.ROOM.getByName("room-1")
            return await stub.fetch(request)
        return Response("toycrane py-do spike")


class Room(DurableObject):
    def __init__(self, ctx, env):
        super().__init__(ctx, env)
        BOOT["count"] += 1
        self.boot_no = BOOT["count"]
        self.born = time.time()
        self.handled = 0

    async def fetch(self, request):
        client, server = WebSocketPair.new().object_values()
        self.ctx.acceptWebSocket(server)
        return Response(None, status=101, web_socket=client)

    async def webSocketMessage(self, ws, message):
        self.handled += 1
        sockets = self.ctx.getWebSockets()
        for s in sockets:
            s.send(f"{message}|inst={id(self)}|boot={self.boot_no}|born={self.born:.3f}|handled={self.handled}|conns={len(sockets)}")

    async def webSocketClose(self, ws, code, reason, wasClean):
        # 1005(코드 없음)·1006(비정상 종료)은 돌려보낼 수 없는 코드라 1000으로 닫음
        ws.close(1000 if code in (1005, 1006) else code, reason)

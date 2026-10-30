"""매장 하나 = Durable Object 하나. 웹소켓은 hibernation API로만 받는다(조용하면 잠들어 무료 사용 시간을 아낀다)."""

from js import WebSocketPair
from workers import DurableObject, Response

from toycrane.adapter.inbound.ws import enter_handler, leave_handler, ws_router


class Store(DurableObject):
    async def fetch(self, request):
        client, server = WebSocketPair.new().object_values()
        self.ctx.acceptWebSocket(server)
        await enter_handler.handle(self.ctx, self.env, server, request)
        return Response(None, status=101, web_socket=client)

    async def webSocketMessage(self, ws, message):
        await ws_router.dispatch(self.ctx, self.env, ws, message)

    async def webSocketClose(self, ws, code, reason, wasClean):
        await leave_handler.handle(self.ctx, self.env, ws)
        try:
            # 1005(코드 없음)·1006(비정상)은 돌려보낼 수 없는 코드라 1000으로 닫는다
            ws.close(1000 if code in (1005, 1006) else code, reason)
        except Exception:
            pass  # 서버가 먼저 닫은 접속(내보내기·만석)은 이미 닫히는 중

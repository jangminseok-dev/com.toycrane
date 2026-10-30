from workers import DurableObject, WorkerEntrypoint

from toycrane.adapter.inbound.http.http_router import route


class Default(WorkerEntrypoint):
    async def fetch(self, request):
        return await route(request, self.env)


class Store(DurableObject):
    """매장 하나 — Task 5에서 웹소켓을 받는다."""

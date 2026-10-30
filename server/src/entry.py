from workers import WorkerEntrypoint

from toycrane.adapter.inbound.http.http_router import route
from toycrane.adapter.inbound.ws.store_durable_object import Store  # noqa: F401 — wrangler 바인딩 STORE가 찾는 DO 클래스


class Default(WorkerEntrypoint):
    async def fetch(self, request):
        return await route(request, self.env)

from toycrane.adapter.outbound import ws_attachment
from toycrane.app.dtos.queue_dto import QueueMember
from toycrane.app.ports.output.queue_registry_port import QueueRegistryPort


class AttachmentQueueRegistry(QueueRegistryPort):
    """교환소 줄을 각 웹소켓 attachment의 "queue": {"c", "at", "head"}에 둔다."""

    def __init__(self, ctx) -> None:
        self._ctx = ctx

    def members(self, counter: int) -> list[QueueMember]:
        rows = []
        for ws in ws_attachment.sockets(self._ctx):
            data = ws_attachment.read(ws)
            q = data.get("queue")
            if q and q["c"] == counter and data.get("player"):
                rows.append(QueueMember(data["conn"], data["player"]["id"], q["at"], q.get("head")))
        return sorted(rows, key=lambda m: m.joined_at)

    def counter_of(self, conn_id: str) -> int | None:
        ws = ws_attachment.find(self._ctx, conn_id)
        q = ws_attachment.read(ws).get("queue") if ws is not None else None
        return q["c"] if q else None

    def join(self, conn_id: str, counter: int, now: float) -> None:
        self._update(conn_id, lambda d: d.__setitem__("queue", {"c": counter, "at": now, "head": None}))

    def remove(self, conn_id: str) -> None:
        self._update(conn_id, lambda d: d.pop("queue", None))

    def mark_head(self, conn_id: str, now: float) -> None:
        self._update(conn_id, lambda d: d["queue"].__setitem__("head", now) if d.get("queue") else None)

    def _update(self, conn_id: str, change) -> None:
        ws = ws_attachment.find(self._ctx, conn_id)
        if ws is not None:
            data = ws_attachment.read(ws)
            change(data)
            ws_attachment.write(ws, data)

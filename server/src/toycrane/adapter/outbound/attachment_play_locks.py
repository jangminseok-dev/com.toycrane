from toycrane.adapter.outbound import ws_attachment
from toycrane.app.ports.output.play_lock_port import PlayLockPort


class AttachmentPlayLocks(PlayLockPort):
    """기계 잠금을 잡은 사람의 웹소켓 attachment "play": {"m", "at", "between"?}에 둔다 — 창을 닫으면 잠금도 사라진다."""

    def __init__(self, ctx) -> None:
        self._ctx = ctx

    def _rows(self):
        for ws in ws_attachment.sockets(self._ctx):
            data = ws_attachment.read(ws)
            if data.get("play"):
                yield data

    def holder(self, machine_id: str) -> tuple[str, float] | None:
        return next(((d["conn"], d["play"]["at"]) for d in self._rows() if d["play"]["m"] == machine_id), None)

    def lock_of(self, conn_id: str) -> tuple[str, float] | None:
        ws = ws_attachment.find(self._ctx, conn_id)
        play = ws_attachment.read(ws).get("play") if ws is not None else None
        return (play["m"], play["at"]) if play else None

    def lock(self, conn_id: str, machine_id: str, now: float) -> None:
        self._update(conn_id, lambda d: d.__setitem__("play", {"m": machine_id, "at": now}))

    def hold(self, conn_id: str, machine_id: str, now: float) -> None:
        self._update(conn_id, lambda d: d.__setitem__("play", {"m": machine_id, "at": now, "between": True}))

    def is_between(self, conn_id: str) -> bool:
        ws = ws_attachment.find(self._ctx, conn_id)
        play = ws_attachment.read(ws).get("play") if ws is not None else None
        return bool(play and play.get("between"))

    def release(self, conn_id: str) -> None:
        self._update(conn_id, lambda d: d.pop("play", None))

    def plays(self) -> dict[str, str]:
        return {d["play"]["m"]: d["player"]["id"] for d in self._rows() if d.get("player")}

    def _update(self, conn_id: str, change) -> None:
        ws = ws_attachment.find(self._ctx, conn_id)
        if ws is not None:
            data = ws_attachment.read(ws)
            change(data)
            ws_attachment.write(ws, data)

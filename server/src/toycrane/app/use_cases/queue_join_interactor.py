from toycrane.app.dtos.queue_dto import QueueJoinCommand
from toycrane.app.ports.input.queue_join_use_case import QueueJoinUseCase
from toycrane.app.ports.output.connections_port import ConnectionsPort
from toycrane.app.ports.output.queue_registry_port import QueueRegistryPort
from toycrane.app.use_cases.queue_settle import drop_stale_heads, settle_queue
from toycrane.domain.coins import QUEUE_SLOTS
from toycrane.domain.layout import COUNTERS


class QueueJoinInteractor(QueueJoinUseCase):
    """교환소 줄 서기: 6명이 차 있으면 "꽉 찼어요". 이미 이 줄이면 오래된 맨 앞만 다시 셈, 다른 줄이면 무시."""

    def __init__(self, queues: QueueRegistryPort, connections: ConnectionsPort) -> None:
        self._queues = queues
        self._connections = connections

    async def join(self, cmd: QueueJoinCommand) -> None:
        if not 0 <= cmd.counter < len(COUNTERS):
            return
        mine = self._queues.counter_of(cmd.conn_id)
        if mine is not None:
            # 이미 이 줄이면 다시 셈만 한다 — 둘만 있는 줄에서 맨 앞이 자리를 비웠을 때 2번째 화면이 차례를 당겨 온다
            if mine == cmd.counter:
                settle_queue(self._queues, self._connections, cmd.counter, cmd.now)
            return
        drop_stale_heads(self._queues, cmd.counter, cmd.now)
        if len(self._queues.members(cmd.counter)) >= QUEUE_SLOTS:
            self._connections.send_queue_no(cmd.conn_id, cmd.counter, "full")
            return
        self._queues.join(cmd.conn_id, cmd.counter, cmd.now)
        settle_queue(self._queues, self._connections, cmd.counter, cmd.now)

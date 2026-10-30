from toycrane.app.dtos.queue_dto import QueueJoinCommand
from toycrane.app.ports.input.queue_join_use_case import QueueJoinUseCase
from toycrane.app.ports.output.connections_port import ConnectionsPort
from toycrane.app.ports.output.queue_registry_port import QueueRegistryPort
from toycrane.app.use_cases.queue_settle import drop_stale_heads, settle_queue
from toycrane.domain.coins import QUEUE_SLOTS
from toycrane.domain.layout import COUNTERS


class QueueJoinInteractor(QueueJoinUseCase):
    """교환소 줄 서기: 이미 어느 줄에 있으면 무시, 6명이 차 있으면 "꽉 찼어요"."""

    def __init__(self, queues: QueueRegistryPort, connections: ConnectionsPort) -> None:
        self._queues = queues
        self._connections = connections

    async def join(self, cmd: QueueJoinCommand) -> None:
        if not 0 <= cmd.counter < len(COUNTERS) or self._queues.counter_of(cmd.conn_id) is not None:
            return
        drop_stale_heads(self._queues, cmd.counter, cmd.now)
        if len(self._queues.members(cmd.counter)) >= QUEUE_SLOTS:
            self._connections.send_queue_no(cmd.conn_id, cmd.counter, "full")
            return
        self._queues.join(cmd.conn_id, cmd.counter, cmd.now)
        settle_queue(self._queues, self._connections, cmd.counter, cmd.now)

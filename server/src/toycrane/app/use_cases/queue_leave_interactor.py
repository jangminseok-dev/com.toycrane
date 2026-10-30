from toycrane.app.dtos.queue_dto import QueueLeaveCommand
from toycrane.app.ports.input.queue_leave_use_case import QueueLeaveUseCase
from toycrane.app.ports.output.connections_port import ConnectionsPort
from toycrane.app.ports.output.queue_registry_port import QueueRegistryPort
from toycrane.app.use_cases.queue_settle import settle_queue


class QueueLeaveInteractor(QueueLeaveUseCase):
    """줄에서 나가기(자리에서 걸어 나감): 빼고 다음 사람을 앞으로."""

    def __init__(self, queues: QueueRegistryPort, connections: ConnectionsPort) -> None:
        self._queues = queues
        self._connections = connections

    async def leave(self, cmd: QueueLeaveCommand) -> None:
        counter = self._queues.counter_of(cmd.conn_id)
        if counter is None:
            return
        self._queues.remove(cmd.conn_id)
        settle_queue(self._queues, self._connections, counter, cmd.now)

from toycrane.app.dtos.play_dto import StandCommand
from toycrane.app.ports.input.stand_use_case import StandUseCase
from toycrane.app.ports.output.connections_port import ConnectionsPort
from toycrane.app.ports.output.play_lock_port import PlayLockPort


class StandInteractor(StandUseCase):
    """그만하기: 판 사이에 잡아 둔 기계 자리를 풀고 모두에게 free. 한 판 도중이면 무시한다."""

    def __init__(self, locks: PlayLockPort, connections: ConnectionsPort) -> None:
        self._locks = locks
        self._connections = connections

    async def stand(self, cmd: StandCommand) -> None:
        seat = self._locks.lock_of(cmd.conn_id)
        if seat is None or not self._locks.is_between(cmd.conn_id):
            return
        self._locks.release(cmd.conn_id)
        self._connections.broadcast_free(seat[0])

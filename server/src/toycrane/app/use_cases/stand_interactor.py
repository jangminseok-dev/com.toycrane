from toycrane.app.dtos.play_dto import StandCommand
from toycrane.app.ports.input.stand_use_case import StandUseCase
from toycrane.app.ports.output.connections_port import ConnectionsPort
from toycrane.app.ports.output.play_lock_port import PlayLockPort


class StandInteractor(StandUseCase):
    """그만하기: 잡아 둔 기계 자리를 풀고 모두에게 free. 판 사이든 한 판 도중(이어 하는 둘째 판부터의 그만하기 — 그 판은 버린다)이든 같다.
    코인은 돌려주지 않는다(물리 뽑기 설계 §4.5). 집게가 도는 중에 풀면 늦게 온 done은 잠금이 없어 무시된다 — 화면은 결과까지 보고 보낸다."""

    def __init__(self, locks: PlayLockPort, connections: ConnectionsPort) -> None:
        self._locks = locks
        self._connections = connections

    async def stand(self, cmd: StandCommand) -> None:
        seat = self._locks.lock_of(cmd.conn_id)
        if seat is None:
            return
        self._locks.release(cmd.conn_id)
        self._connections.broadcast_free(seat[0])

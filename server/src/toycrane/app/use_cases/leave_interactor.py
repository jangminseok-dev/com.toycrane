from toycrane.app.dtos.leave_dto import LeaveCommand
from toycrane.app.ports.input.leave_use_case import LeaveUseCase
from toycrane.app.ports.output.connections_port import ConnectionsPort
from toycrane.app.ports.output.occupancy_port import OccupancyPort
from toycrane.app.ports.output.play_lock_port import PlayLockPort
from toycrane.app.ports.output.player_registry_port import PlayerRegistryPort
from toycrane.app.ports.output.wallet_port import WalletPort
from toycrane.app.use_cases.connection_cleanup import release_connection
from toycrane.app.use_cases.occupancy_note import note_occupancy


class LeaveInteractor(LeaveUseCase):
    """매장에서 나가기: 목록에서 빼고 남은 사람들에게 알린 뒤 인원을 기록한다.
    기계를 하는 도중이었으면(창 닫기·배포) 쓴 코인 1개를 돌려주고 기계를 푼다."""

    def __init__(
        self, registry: PlayerRegistryPort, connections: ConnectionsPort, occupancy: OccupancyPort, *,
        locks: PlayLockPort, wallet: WalletPort,
    ) -> None:
        self._registry = registry
        self._connections = connections
        self._occupancy = occupancy
        self._locks = locks
        self._wallet = wallet

    async def leave(self, cmd: LeaveCommand) -> None:
        gone = self._registry.remove(cmd.conn_id)
        if gone is None:
            return  # 이미 같은 게스트의 새 접속이 정리했다(enter의 밀어내기)
        self._connections.broadcast_leave(cmd.conn_id, gone.player_id)
        release_connection(cmd.conn_id, self._locks, self._connections)
        await note_occupancy(self._occupancy, cmd.store_no, len(self._registry.entries()), cmd.now)

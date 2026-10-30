from toycrane.app.dtos.leave_dto import LeaveCommand
from toycrane.app.ports.input.leave_use_case import LeaveUseCase
from toycrane.app.ports.output.connections_port import ConnectionsPort
from toycrane.app.ports.output.occupancy_port import OccupancyPort
from toycrane.app.ports.output.player_registry_port import PlayerRegistryPort
from toycrane.app.use_cases.occupancy_note import note_occupancy


class LeaveInteractor(LeaveUseCase):
    """매장에서 나가기: 목록에서 빼고 남은 사람들에게 알린 뒤 인원을 기록한다."""

    def __init__(self, registry: PlayerRegistryPort, connections: ConnectionsPort, occupancy: OccupancyPort) -> None:
        self._registry = registry
        self._connections = connections
        self._occupancy = occupancy

    async def leave(self, cmd: LeaveCommand) -> None:
        gone = self._registry.remove(cmd.conn_id)
        if gone is None:
            return
        self._connections.broadcast_leave(cmd.conn_id, gone.player_id)
        await note_occupancy(self._occupancy, cmd.store_no, len(self._registry.entries()), cmd.now)

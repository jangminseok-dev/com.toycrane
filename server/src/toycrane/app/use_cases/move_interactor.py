import math
from dataclasses import replace

from toycrane.app.dtos.move_dto import MoveCommand
from toycrane.app.dtos.player_view import PlayerView
from toycrane.app.ports.input.move_use_case import MoveUseCase
from toycrane.app.ports.output.connections_port import ConnectionsPort
from toycrane.app.ports.output.player_registry_port import PlayerRegistryPort
from toycrane.domain.movement import accept_move
from toycrane.domain.value_objects.heading import Heading
from toycrane.domain.value_objects.position import Position

CORRECTION_EPSILON = 0.01


class MoveInteractor(MoveUseCase):
    """이동 중계: 위치를 검증해 저장하고 다른 사람들에게 알린다. 말이 안 되는 위치면 본인에게 보정을 보낸다."""

    def __init__(self, registry: PlayerRegistryPort, connections: ConnectionsPort) -> None:
        self._registry = registry
        self._connections = connections

    async def move(self, cmd: MoveCommand) -> None:
        current = dict(self._registry.entries()).get(cmd.conn_id)
        if current is None:
            return
        claimed = Position(cmd.x, cmd.z)
        accepted, budget = accept_move(current.position, current.budget, current.updated_at, claimed, cmd.now)
        moved = replace(current, position=accepted, heading=Heading(cmd.dx, cmd.dz), updated_at=cmd.now, budget=budget)
        self._registry.put(cmd.conn_id, moved)
        self._connections.broadcast_move(cmd.conn_id, PlayerView.of(moved))
        if math.hypot(accepted.x - claimed.x, accepted.z - claimed.z) > CORRECTION_EPSILON:
            self._connections.send_correction(cmd.conn_id, accepted.x, accepted.z)

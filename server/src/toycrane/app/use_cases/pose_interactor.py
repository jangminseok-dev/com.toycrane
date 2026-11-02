from toycrane.app.dtos.pose_dto import PoseCommand
from toycrane.app.ports.input.pose_use_case import PoseUseCase
from toycrane.app.ports.output.connections_port import ConnectionsPort
from toycrane.app.ports.output.play_lock_port import PlayLockPort
from toycrane.app.ports.output.player_registry_port import PlayerRegistryPort


class PoseInteractor(PoseUseCase):
    """중계 (물리 뽑기 설계 §4.5): 그 기계를 한 판 중으로 잠근 사람이 보낸 집게·인형 자리 묶음(0.4초)을 저장 없이 같은 매장에 그대로 뿌린다."""

    def __init__(self, registry: PlayerRegistryPort, locks: PlayLockPort, connections: ConnectionsPort) -> None:
        self._registry = registry
        self._locks = locks
        self._connections = connections

    async def relay(self, cmd: PoseCommand) -> None:
        lock = self._locks.lock_of(cmd.conn_id)
        me = dict(self._registry.entries()).get(cmd.conn_id)
        if lock is None or me is None or lock[0] != cmd.machine_id or self._locks.is_between(cmd.conn_id):
            return
        self._connections.broadcast_pose(cmd.conn_id, me.player_id, cmd.machine_id, [[age, list(c), [list(d) for d in dolls]] for age, c, dolls in cmd.frames])

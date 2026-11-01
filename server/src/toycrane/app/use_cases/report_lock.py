from toycrane.app.dtos.done_dto import DoneCommand
from toycrane.app.ports.output.connections_port import ConnectionsPort
from toycrane.app.ports.output.play_lock_port import PlayLockPort
from toycrane.app.ports.output.player_registry_port import PlayerRegistryPort
from toycrane.domain.play_rules import expired


def take_report(cmd: DoneCommand, registry: PlayerRegistryPort, locks: PlayLockPort, connections: ConnectionsPort):
    """판 보고를 받아 줄 수 있으면 (me, machine_id)를 돌려주고 잠금을 판 사이로 바꾼다 — 두 번째 보고는 무시되고, 이어서 할 자리는 남는다.
    인형·피규어·고리·미는 뽑기 기계 같은 규칙."""
    lock = locks.lock_of(cmd.conn_id)
    me = dict(registry.entries()).get(cmd.conn_id)
    if lock is None or me is None or locks.is_between(cmd.conn_id) or lock[0] != cmd.machine_id:
        return None
    machine_id, started = lock
    if expired(started, cmd.now, machine_id):
        locks.release(cmd.conn_id)
        connections.broadcast_free(machine_id)
        return None
    locks.hold(cmd.conn_id, machine_id, cmd.now)
    return me, machine_id

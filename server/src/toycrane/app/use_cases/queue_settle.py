from toycrane.app.ports.output.connections_port import ConnectionsPort
from toycrane.app.ports.output.queue_registry_port import QueueRegistryPort
from toycrane.domain.coin_queue import stale_head


def drop_stale_heads(queues: QueueRegistryPort, counter: int, now: float) -> None:
    """오래 안 받는 맨 앞은 빼고 다음 사람으로 (여러 명이면 반복)."""
    members = queues.members(counter)
    while members and stale_head(members[0].head_since, now):
        queues.remove(members[0].conn_id)
        members = members[1:]


def settle_queue(queues: QueueRegistryPort, connections: ConnectionsPort, counter: int, now: float) -> None:
    """줄을 바꾼 뒤 꼭 거친다: 오래된 맨 앞 빼기 → 새 맨 앞에 시각 표시 → 순서를 모두에게."""
    drop_stale_heads(queues, counter, now)
    members = queues.members(counter)
    if members and members[0].head_since is None:
        queues.mark_head(members[0].conn_id, now)
    connections.broadcast_queue(counter, [m.player_id for m in members])

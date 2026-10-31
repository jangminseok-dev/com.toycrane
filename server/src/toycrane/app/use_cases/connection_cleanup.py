from toycrane.app.ports.output.connections_port import ConnectionsPort
from toycrane.app.ports.output.play_lock_port import PlayLockPort
from toycrane.app.ports.output.queue_registry_port import QueueRegistryPort
from toycrane.app.use_cases.queue_settle import settle_queue


def release_connection(
    conn_id: str, queues: QueueRegistryPort, locks: PlayLockPort, connections: ConnectionsPort, now: float,
) -> int:
    """매장을 떠나는 접속(창 닫기, 같은 게스트가 다른 탭·새 연결로 들어와 밀려남)이 쥔 것을 푼다.
    하던 기계는 풀고 모두에게 free, 서 있던 줄에서는 빼고 다음 사람을 앞으로. 돌려줄 코인 수(0·1)를 돌려준다 —
    D1 쓰기는 부르는 쪽이 목록을 다 바꾼 뒤에 한다(그 사이 다른 메시지가 끼어들지 않게)."""
    refund = 0
    playing = locks.lock_of(conn_id)
    if playing is not None:
        refund = 0 if locks.is_between(conn_id) else 1  # 판 사이면 이미 끝난 판이라 돌려줄 코인이 없다
        locks.release(conn_id)
        connections.broadcast_free(playing[0])
    counter = queues.counter_of(conn_id)
    if counter is not None:
        queues.remove(conn_id)
        settle_queue(queues, connections, counter, now)
    return refund

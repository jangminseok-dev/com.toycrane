from toycrane.app.ports.output.connections_port import ConnectionsPort
from toycrane.app.ports.output.play_lock_port import PlayLockPort


def release_connection(conn_id: str, locks: PlayLockPort, connections: ConnectionsPort) -> None:
    """매장을 떠나는 접속(창 닫기, 같은 게스트가 다른 탭·새 연결로 들어와 밀려남)이 쥔 것을 푼다.
    하던 기계는 풀고 모두에게 free. 코인은 돌려주지 않는다 — 결과가 화면에 먼저 보이므로 판 도중 새로 고침이
    공짜 연습이 되면 안 된다 (물리 뽑기 설계 §4.5, 최종 리뷰 I1)."""
    playing = locks.lock_of(conn_id)
    if playing is not None:
        locks.release(conn_id)
        connections.broadcast_free(playing[0])

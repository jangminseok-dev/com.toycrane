import math
from dataclasses import replace

from toycrane.app.dtos.give_dto import GiveCommand
from toycrane.app.ports.input.give_use_case import GiveUseCase
from toycrane.app.ports.output.connections_port import ConnectionsPort
from toycrane.app.ports.output.play_lock_port import PlayLockPort
from toycrane.app.ports.output.player_registry_port import PlayerRegistryPort
from toycrane.app.ports.output.wallet_port import WalletPort
from toycrane.domain.coins import GIVE_REACH, WALLET_CAP, give_limit


class GiveInteractor(GiveUseCase):
    """조르는 사람에게 코인 주기 (설계 2026-10-31 교환소 개편 §4.4): 주는 사람이 개수를 정하고, 서버가 다시 확인한 뒤
    두 지갑을 한 번에 바꾼다. 받으면 조르기가 끝나고, 주기·기쁨 모션과 알림이 모두에게 간다."""

    def __init__(self, registry: PlayerRegistryPort, wallet: WalletPort, connections: ConnectionsPort, locks: PlayLockPort) -> None:
        self._registry = registry
        self._wallet = wallet
        self._connections = connections
        self._locks = locks

    async def give(self, cmd: GiveCommand) -> None:
        entries = dict(self._registry.entries())
        me = entries.get(cmd.conn_id)
        if me is None:
            return
        target = next(((c, p) for c, p in entries.items() if p.player_id == cmd.to), None)
        why = self._refusal(cmd, me, target)
        if why is None:
            to_conn, to = target
            have, theirs = await self._wallet.balance(me.guest_id), await self._wallet.balance(to.guest_id)
            why = "poor" if cmd.n > have else "full" if cmd.n > give_limit(have, theirs) else None
        if why is not None:
            self._connections.send_give_no(cmd.conn_id, why)
            return
        moved = await self._wallet.transfer(me.guest_id, to.guest_id, cmd.n, WALLET_CAP, cmd.now)
        if moved is None:  # 그 사이 다른 사람이 먼저 줬다
            self._connections.send_give_no(cmd.conn_id, "full")
            return
        self._registry.put(to_conn, replace(to, beg_room=None))
        self._connections.broadcast_beg(to.player_id, None)
        self._connections.broadcast_gave(me.player_id, to.player_id, cmd.n)
        self._connections.send_coins(cmd.conn_id, moved[0], -cmd.n)
        self._connections.send_coins(to_conn, moved[1], cmd.n)

    def _refusal(self, cmd: GiveCommand, me, target) -> str | None:
        if target is None:
            return "gone"
        _, to = target
        if to.beg_room is None:
            return "stopped"
        if to.guest_id == me.guest_id:
            return "self"
        if self._locks.lock_of(cmd.conn_id) is not None:
            return "playing"
        if math.hypot(me.position.x - to.position.x, me.position.z - to.position.z) > GIVE_REACH:
            return "far"
        return None

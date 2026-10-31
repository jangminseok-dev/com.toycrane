from dataclasses import replace

from toycrane.app.dtos.beg_dto import BegCommand
from toycrane.app.ports.input.beg_use_case import BegUseCase
from toycrane.app.ports.output.connections_port import ConnectionsPort
from toycrane.app.ports.output.play_lock_port import PlayLockPort
from toycrane.app.ports.output.player_registry_port import PlayerRegistryPort
from toycrane.app.ports.output.wallet_port import WalletPort
from toycrane.domain.coins import WALLET_CAP


class BegInteractor(BegUseCase):
    """맵 조르기 켜고 끄기 (설계 2026-10-31 교환소 개편 §4.3): 조르는 중이면 모두에게 보이고, 주는 사람 화면이
    줄 수 있는 최대를 알게 더 받을 수 있는 코인 수(room)를 함께 알린다. 기계를 하는 동안은 조를 수 없다."""

    def __init__(self, registry: PlayerRegistryPort, wallet: WalletPort, connections: ConnectionsPort, locks: PlayLockPort) -> None:
        self._registry = registry
        self._wallet = wallet
        self._connections = connections
        self._locks = locks

    async def beg(self, cmd: BegCommand) -> None:
        me = dict(self._registry.entries()).get(cmd.conn_id)
        if me is None:
            return
        if not cmd.on:
            if me.beg_room is not None:
                self._registry.put(cmd.conn_id, replace(me, beg_room=None))
                self._connections.broadcast_beg(me.player_id, None)
            return
        if self._locks.lock_of(cmd.conn_id) is not None:
            return
        room = max(0, WALLET_CAP - await self._wallet.balance(me.guest_id))
        self._registry.put(cmd.conn_id, replace(me, beg_room=room))
        self._connections.broadcast_beg(me.player_id, room)

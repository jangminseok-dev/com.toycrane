from collections.abc import Callable

from toycrane.app.dtos.enter_dto import EnterCommand, EnterResult, StoreFull
from toycrane.app.dtos.player_view import PlayerView
from toycrane.app.ports.input.enter_use_case import EnterUseCase
from toycrane.app.ports.output.connections_port import ConnectionsPort
from toycrane.app.ports.output.occupancy_port import OccupancyPort
from toycrane.app.ports.output.player_registry_port import PlayerRegistryPort
from toycrane.app.use_cases.occupancy_note import note_occupancy
from toycrane.domain.entities.player import Player
from toycrane.domain.store_rules import STORE_CAPACITY, spawn_position
from toycrane.domain.value_objects.heading import Heading

KICK_OTHER_TAB = 4003


class EnterInteractor(EnterUseCase):
    """매장에 들어오기: 같은 게스트의 이전 접속은 내보내고, 정원 안이면 스폰 링에 세운다."""

    def __init__(
        self,
        registry: PlayerRegistryPort,
        connections: ConnectionsPort,
        occupancy: OccupancyPort,
        new_player_id: Callable[[], str],
    ) -> None:
        self._registry = registry
        self._connections = connections
        self._occupancy = occupancy
        self._new_player_id = new_player_id

    async def enter(self, cmd: EnterCommand) -> EnterResult:
        for conn_id, old in self._registry.entries():
            if old.guest_id == cmd.guest_id:
                self._registry.remove(conn_id)
                self._connections.kick(conn_id, KICK_OTHER_TAB, "다른 창에서 접속")
                self._connections.broadcast_leave(cmd.conn_id, old.player_id)
        others = self._registry.entries()
        if len(others) >= STORE_CAPACITY:
            # 실제 인원을 다시 적어 배정이 이 매장을 비었다고 오해하지 않게 한다
            await note_occupancy(self._occupancy, cmd.store_no, len(others), cmd.now)
            raise StoreFull(cmd.store_no)
        me = Player(
            self._new_player_id(), cmd.guest_id, cmd.nickname, cmd.color,
            spawn_position(cmd.seed), Heading.STOP, cmd.now,
        )
        self._registry.put(cmd.conn_id, me)
        you = PlayerView.of(me)
        result = EnterResult(you=you, others=tuple(PlayerView.of(p) for _, p in others))
        self._connections.send_welcome(cmd.conn_id, cmd.store_no, you, list(result.others))
        self._connections.broadcast_join(cmd.conn_id, you)
        await note_occupancy(self._occupancy, cmd.store_no, len(others) + 1, cmd.now)
        return result

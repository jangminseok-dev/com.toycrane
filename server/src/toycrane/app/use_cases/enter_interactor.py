import logging
import random
from collections.abc import Awaitable, Callable

from toycrane.app.dtos.enter_dto import EnterCommand, EnterResult, StoreFull
from toycrane.app.dtos.player_view import PlayerView
from toycrane.app.dtos.store_snapshot import StoreSnapshot
from toycrane.app.ports.input.enter_use_case import EnterUseCase
from toycrane.app.ports.output.bag_port import BagPort
from toycrane.app.ports.output.connections_port import ConnectionsPort
from toycrane.app.ports.output.figure_boxes_port import FigureBoxesPort
from toycrane.app.ports.output.machine_contents_port import MachineContentsPort
from toycrane.app.ports.output.occupancy_port import OccupancyPort
from toycrane.app.ports.output.play_lock_port import PlayLockPort
from toycrane.app.ports.output.player_registry_port import PlayerRegistryPort
from toycrane.app.ports.output.wallet_port import WalletPort
from toycrane.app.use_cases.connection_cleanup import release_connection
from toycrane.app.use_cases.figure_boxes import ensure_figures
from toycrane.domain.hook import HOOK_RULES
from toycrane.app.use_cases.machine_contents import ensure_contents
from toycrane.app.use_cases.occupancy_note import note_occupancy
from toycrane.domain.entities.player import Player
from toycrane.domain.store_rules import STORE_CAPACITY, spawn_position
from toycrane.domain.value_objects.heading import Heading

KICK_OTHER_TAB = 4003


class EnterInteractor(EnterUseCase):
    """매장에 들어오기: 같은 게스트의 이전 접속은 내보내고, 정원 안이면 스폰 링에 세운다.
    welcome에는 내 코인·가방, 기계 속 인형, 하는 중인 기계를 함께 담는다."""

    def __init__(
        self,
        registry: PlayerRegistryPort,
        connections: ConnectionsPort,
        occupancy: OccupancyPort,
        new_player_id: Callable[[], str],
        *,
        wallet: WalletPort,
        bag: BagPort,
        contents: MachineContentsPort,
        figures: FigureBoxesPort,
        hooks: FigureBoxesPort,
        locks: PlayLockPort,
        rng: random.Random,
    ) -> None:
        self._registry = registry
        self._connections = connections
        self._occupancy = occupancy
        self._new_player_id = new_player_id
        self._wallet = wallet
        self._bag = bag
        self._contents = contents
        self._figures = figures
        self._hooks = hooks
        self._locks = locks
        self._rng = rng

    async def enter(self, cmd: EnterCommand) -> EnterResult:
        # D1·DO 저장소 읽기를 먼저 끝낸다 — 목록을 바꾼 뒤(put~welcome) 기다리면 그 사이 온 leave·join을 welcome이 덮는다
        coins = await _or_zero(self._wallet.balance(cmd.guest_id))
        bag = await _or_zero(self._bag.total(cmd.guest_id))
        stocks = await ensure_contents(self._contents, self._rng)
        figures = await ensure_figures(self._figures, self._rng)
        hooks = await ensure_figures(self._hooks, self._rng, HOOK_RULES)  # 고리 걸기 상자도 같은 형식으로(welcome figures)
        for conn_id, old in self._registry.entries():
            if old.guest_id == cmd.guest_id:
                # 같은 게스트의 이전 접속(네트워크가 바뀜·다른 탭): 하던 기계·줄을 정리하고 내보낸다
                release_connection(conn_id, self._locks, self._connections)
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
        snapshot = StoreSnapshot(
            coins=coins,
            bag=bag,
            machines={m: s.dolls for m, s in stocks.items()},
            plays=self._locks.plays(),
            figures={m: s.box for m, s in {**figures, **hooks}.items()},
        )
        self._connections.send_welcome(cmd.conn_id, cmd.store_no, you, list(result.others), snapshot)
        self._connections.broadcast_join(cmd.conn_id, you)
        await note_occupancy(self._occupancy, cmd.store_no, len(others) + 1, cmd.now)
        return result


async def _or_zero(read: Awaitable[int]) -> int:
    """코인·가방 수는 화면 표시용 — D1 읽기가 실패해도 입장은 된다(1단계 최종 리뷰 #10과 같은 원칙)."""
    try:
        return await read
    except Exception:
        logging.warning("D1 read failed on enter", exc_info=True)
        return 0

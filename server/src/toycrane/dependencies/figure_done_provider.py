from toycrane.adapter.outbound.attachment_play_locks import AttachmentPlayLocks
from toycrane.adapter.outbound.attachment_player_registry import AttachmentPlayerRegistry
from toycrane.adapter.outbound.d1_bag_adapter import D1BagAdapter
from toycrane.adapter.outbound.do_storage_figure_boxes import HOOK_KEY, DoStorageFigureBoxes
from toycrane.adapter.outbound.ws_connections_adapter import WsConnectionsAdapter
from toycrane.app.ports.input.done_use_case import DoneUseCase
from toycrane.app.use_cases.figure_done_interactor import FigureDoneInteractor
from toycrane.domain.hook import HOOK_RULES


def get_figure_done_use_case(ctx, env) -> DoneUseCase:
    return FigureDoneInteractor(
        AttachmentPlayerRegistry(ctx), AttachmentPlayLocks(ctx), DoStorageFigureBoxes(ctx.storage), D1BagAdapter(env.DB), WsConnectionsAdapter(ctx),
    )


def get_hook_done_use_case(ctx, env) -> DoneUseCase:
    """고리 걸기(계획 12): 피규어와 같은 판 보고, 규칙·저장 키·가방 구역만 다르다."""
    return FigureDoneInteractor(
        AttachmentPlayerRegistry(ctx), AttachmentPlayLocks(ctx), DoStorageFigureBoxes(ctx.storage, HOOK_KEY), D1BagAdapter(env.DB), WsConnectionsAdapter(ctx),
        rules=HOOK_RULES,
    )

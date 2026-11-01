from toycrane.adapter.outbound.attachment_play_locks import AttachmentPlayLocks
from toycrane.adapter.outbound.attachment_player_registry import AttachmentPlayerRegistry
from toycrane.adapter.outbound.d1_bag_adapter import D1BagAdapter
from toycrane.adapter.outbound.do_storage_figure_boxes import DoStorageFigureBoxes
from toycrane.adapter.outbound.ws_connections_adapter import WsConnectionsAdapter
from toycrane.app.ports.input.done_use_case import DoneUseCase
from toycrane.app.use_cases.figure_done_interactor import FigureDoneInteractor


def get_figure_done_use_case(ctx, env) -> DoneUseCase:
    return FigureDoneInteractor(
        AttachmentPlayerRegistry(ctx), AttachmentPlayLocks(ctx), DoStorageFigureBoxes(ctx.storage), D1BagAdapter(env.DB), WsConnectionsAdapter(ctx),
    )

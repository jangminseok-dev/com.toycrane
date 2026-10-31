import random

from toycrane.adapter.outbound.attachment_play_locks import AttachmentPlayLocks
from toycrane.adapter.outbound.do_storage_machine_contents import DoStorageMachineContents
from toycrane.adapter.outbound.ws_connections_adapter import WsConnectionsAdapter
from toycrane.app.ports.input.stock_use_case import StockUseCase
from toycrane.app.use_cases.stock_interactor import StockInteractor


def get_stock_use_case(ctx, env) -> StockUseCase:
    return StockInteractor(
        DoStorageMachineContents(ctx.storage, str(ctx.id)), AttachmentPlayLocks(ctx), WsConnectionsAdapter(ctx), random.Random(),
    )

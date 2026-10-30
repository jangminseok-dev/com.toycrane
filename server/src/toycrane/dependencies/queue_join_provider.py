from toycrane.adapter.outbound.attachment_queue_registry import AttachmentQueueRegistry
from toycrane.adapter.outbound.ws_connections_adapter import WsConnectionsAdapter
from toycrane.app.ports.input.queue_join_use_case import QueueJoinUseCase
from toycrane.app.use_cases.queue_join_interactor import QueueJoinInteractor


def get_queue_join_use_case(ctx, env) -> QueueJoinUseCase:
    return QueueJoinInteractor(AttachmentQueueRegistry(ctx), WsConnectionsAdapter(ctx))

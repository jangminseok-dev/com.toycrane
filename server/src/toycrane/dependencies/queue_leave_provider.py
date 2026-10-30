from toycrane.adapter.outbound.attachment_queue_registry import AttachmentQueueRegistry
from toycrane.adapter.outbound.ws_connections_adapter import WsConnectionsAdapter
from toycrane.app.ports.input.queue_leave_use_case import QueueLeaveUseCase
from toycrane.app.use_cases.queue_leave_interactor import QueueLeaveInteractor


def get_queue_leave_use_case(ctx, env) -> QueueLeaveUseCase:
    return QueueLeaveInteractor(AttachmentQueueRegistry(ctx), WsConnectionsAdapter(ctx))

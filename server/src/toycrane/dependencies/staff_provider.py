from toycrane.adapter.outbound.attachment_play_locks import AttachmentPlayLocks
from toycrane.adapter.outbound.do_storage_machine_contents import DoStorageMachineContents
from toycrane.adapter.outbound.ws_connections_adapter import WsConnectionsAdapter
from toycrane.app.ports.input.staff_use_case import StaffUseCase
from toycrane.app.use_cases.staff_interactor import StaffInteractor


def get_staff_use_case(ctx, env) -> StaffUseCase:
    return StaffInteractor(AttachmentPlayLocks(ctx), DoStorageMachineContents(ctx.storage, str(ctx.id), ctx), WsConnectionsAdapter(ctx))

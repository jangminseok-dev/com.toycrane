from toycrane.adapter.outbound.attachment_play_locks import AttachmentPlayLocks
from toycrane.adapter.outbound.attachment_player_registry import AttachmentPlayerRegistry
from toycrane.adapter.outbound.do_storage_figure_boxes import HOOK_KEY, DoStorageFigureBoxes
from toycrane.adapter.outbound.do_storage_machine_contents import DoStorageMachineContents
from toycrane.adapter.outbound.do_storage_staff_board import DoStorageStaffBoard
from toycrane.adapter.outbound.ws_connections_adapter import WsConnectionsAdapter
from toycrane.app.ports.input.staff_use_case import StaffUseCase
from toycrane.app.use_cases.staff_interactor import StaffInteractor


def get_staff_use_case(ctx, env) -> StaffUseCase:
    return StaffInteractor(
        AttachmentPlayerRegistry(ctx), AttachmentPlayLocks(ctx), DoStorageMachineContents(ctx.storage, str(ctx.id), ctx),
        DoStorageFigureBoxes(ctx.storage), DoStorageFigureBoxes(ctx.storage, HOOK_KEY), DoStorageStaffBoard(ctx.storage), WsConnectionsAdapter(ctx),
    )

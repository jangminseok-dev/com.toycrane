from toycrane.adapter.outbound.log_manager_record_adapter import LogManagerRecordAdapter
from toycrane.app.ports.input.manager_use_case import ManagerUseCase
from toycrane.app.use_cases.manager_interactor import ManagerInteractor


def get_manager_use_case(env) -> ManagerUseCase:
    return ManagerInteractor(LogManagerRecordAdapter())

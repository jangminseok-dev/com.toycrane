from abc import ABC, abstractmethod

from toycrane.app.dtos.admission_dto import AdmissionQuery, AdmissionResult


class AdmissionUseCase(ABC):
    @abstractmethod
    async def admit(self, query: AdmissionQuery) -> AdmissionResult: ...

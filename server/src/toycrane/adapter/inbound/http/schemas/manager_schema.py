from toycrane.app.dtos.manager_dto import ManagerResponse


def to_json(response: ManagerResponse) -> dict:
    return {"name": response.name, "introduction": response.introduction, "endpoints": list(response.endpoints)}

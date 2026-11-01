from toycrane.app.dtos.bag_dto import BagEntry


def to_json(entries: list[BagEntry]) -> dict:
    return {"items": [{"doll": e.doll, "color": e.color, "rare": e.rare, "zone": e.zone, "count": e.count, "first_at": e.first_at} for e in entries]}

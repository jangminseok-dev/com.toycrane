from dataclasses import dataclass


@dataclass(frozen=True)
class CreateGuestCommand:
    nickname: str


@dataclass(frozen=True)
class FindGuestQuery:
    guest_id: str


@dataclass(frozen=True)
class GuestView:
    guest_id: str
    nickname: str
    color: int  # 아바타 색 번호 0~7 (화면 world/avatar.ts 팔레트 순서)

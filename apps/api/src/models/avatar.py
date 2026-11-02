"""Where a member's uploaded picture is, for every model that shows a member."""

from db.tables.user import User


def avatar_url(user: User) -> str | None:
    """The picture's URL, which changes with each upload so it can be cached for good."""
    if user.avatar_version is None:
        return None
    return f"/api/avatars/{user.id}?v={user.avatar_version}"

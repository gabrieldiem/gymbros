"""Domain objects → API models."""

from models.me import CrewResponse, MeResponse
from services.profile_service import Profile


def to_me_response(profile: Profile) -> MeResponse:
    """Build the /api/me body from a user and their crew."""
    user = profile.user
    crew = CrewResponse.model_validate(profile.crew) if profile.crew else None
    return MeResponse.model_validate(
        {
            "id": user.id,
            "email": user.email,
            "display_name": user.display_name,
            "initials": user.initials,
            "color": user.color,
            "language": user.language,
            "crew": crew,
        }
    )

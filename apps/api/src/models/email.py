"""Email settings, messages from admins and unsubscribing."""

import uuid

from pydantic import BaseModel, EmailStr, Field, StringConstraints
from typing_extensions import Annotated

Subject = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
MessageBody = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=5000)
]


class EmailSettingsResponse(BaseModel):
    """What the backoffice has decided, and whether email can go out at all."""

    welcome_enabled: bool
    digest_enabled: bool
    digest_hour: int
    configured: bool
    sender: str
    digests_sent_this_week: int


class UpdateEmailSettingsRequest(BaseModel):
    """Omitted fields stay as they are."""

    welcome_enabled: bool | None = None
    digest_enabled: bool | None = None
    digest_hour: int | None = Field(default=None, ge=0, le=23)


class AudienceModel(BaseModel):
    """Who a message goes to: one crew, one person, or with neither, everyone."""

    crew_id: uuid.UUID | None = None
    email: EmailStr | None = None


class SendMessageRequest(AudienceModel):
    """A message written in the backoffice. `dry_run` only counts who it would reach."""

    subject: Subject
    body: MessageBody
    dry_run: bool = False


class MessageResultResponse(BaseModel):
    """How many people it reaches, and how many it went out to. People who turned off updates
    don't count."""

    recipients: int
    sent: int


class TestDigestResponse(BaseModel):
    """Whether the test went out."""

    sent: bool

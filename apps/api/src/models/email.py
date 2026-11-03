"""Email settings, messages from admins and unsubscribing."""

import uuid
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, StringConstraints, model_validator
from typing_extensions import Annotated

Subject = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
# Well above Gmail's own limit, which clips an email at about 100 KB.
MessageHtml = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200_000)
]
LiveTemplate = Literal["welcome", "digest"]


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
    """Either a message written in the backoffice, HTML with a subject, or an email GYMBROS makes
    for each person (`template`). `dry_run` only counts who it would reach. `full_document`: the
    HTML is a whole email, not something to put in the frame."""

    subject: Subject | None = None
    html: MessageHtml | None = None
    full_document: bool = False
    template: LiveTemplate | None = None
    dry_run: bool = False

    @model_validator(mode="after")
    def check_it_is_one_or_the_other(self) -> "SendMessageRequest":
        """A written message needs its words, and a template brings its own."""
        written = self.subject is not None and self.html is not None
        if self.template is None and not written:
            raise ValueError("A message needs a subject and html, or a template")
        if self.template is not None and (self.subject is not None or self.html is not None):
            raise ValueError("A template brings its own subject and html")
        return self


class PreviewRequest(BaseModel):
    """What's being written, to see it as it will arrive."""

    html: MessageHtml
    full_document: bool = False


class PreviewResponse(BaseModel):
    """The whole email."""

    html: str


class EmailTemplateResponse(BaseModel):
    """One email to start from. `live`: it can also go out as it is, made for each person."""

    id: str
    subject: str
    html: str
    live: bool


class MessageResultResponse(BaseModel):
    """How many people it reaches, and how many it went out to. People who turned off updates
    don't count."""

    recipients: int
    sent: int


class TestDigestResponse(BaseModel):
    """Whether the test went out."""

    sent: bool

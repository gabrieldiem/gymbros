"""Feedback request and response models."""

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, StringConstraints
from typing_extensions import Annotated

FeedbackKind = Literal["idea", "bug", "other"]
FeedbackBody = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)
]


class SendFeedbackRequest(BaseModel):
    """A message from a member."""

    kind: FeedbackKind
    body: FeedbackBody


class FeedbackItem(BaseModel):
    """A message in the backoffice."""

    id: uuid.UUID
    kind: FeedbackKind
    body: str
    created_at: datetime
    handled: bool
    display_name: str
    email: str


class SetHandledRequest(BaseModel):
    """Whether a message has been dealt with."""

    handled: bool


class SetHandledResponse(BaseModel):
    """Whether a message has been dealt with, after the change."""

    handled: bool

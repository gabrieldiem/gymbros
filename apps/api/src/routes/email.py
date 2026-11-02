"""Unsubscribing from a link in an email. No sign-in: the link is signed."""

import uuid

from fastapi import APIRouter, Depends, Query, status

from dependencies import get_email_service
from models.errors import error_responses
from services.email_service import EmailService
from services.errors import NotAuthenticated

router = APIRouter(prefix="/email", tags=["Email"])


@router.post("/unsubscribe", status_code=status.HTTP_204_NO_CONTENT, responses=error_responses(401))
async def unsubscribe(
    u: uuid.UUID = Query(),
    t: str = Query(max_length=128),
    email: EmailService = Depends(get_email_service),
) -> None:
    """Stop the weekly digest and messages from admins. Mail apps call this for one-click."""
    if not await email.unsubscribe(u, t):
        raise NotAuthenticated("bad unsubscribe link")

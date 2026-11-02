"""Members send feedback from the app."""

from fastapi import APIRouter, Depends, status

from db.tables.user import User
from dependencies import get_current_user, get_feedback_service
from models.errors import error_responses
from models.feedback import SendFeedbackRequest
from services.feedback_service import FeedbackService

router = APIRouter(prefix="/feedback", tags=["Me"])


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    responses=error_responses(401, 422, 429),
)
async def send_feedback(
    body: SendFeedbackRequest,
    user: User = Depends(get_current_user),
    feedback: FeedbackService = Depends(get_feedback_service),
) -> None:
    """Send an idea, a bug or anything else to the people running the app."""
    await feedback.send(user, body.kind, body.body)

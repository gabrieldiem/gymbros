"""The backoffice API. Every route here is for admins only (ADMIN_EMAILS)."""

import uuid
from typing import Literal

from fastapi import APIRouter, Depends, status

from db.tables.feedback import Feedback
from db.tables.user import User
from dependencies import (
    get_admin_service,
    get_email_service,
    get_feedback_service,
    get_current_admin,
    get_current_member,
    get_settings,
)
from models.avatar import avatar_url
from models.admin import (
    AdjustPointsRequest,
    AdminActionResponse,
    AdminCrewResponse,
    AdminMemberResponse,
    CreateCrewRequest,
    InviteSentResponse,
    OverviewResponse,
    SendInviteRequest,
    UpdateCrewRequest,
)
from models.email import (
    EmailTemplateResponse,
    PreviewRequest,
    PreviewResponse,
    EmailSettingsResponse,
    MessageResultResponse,
    SendMessageRequest,
    TestDigestResponse,
    UpdateEmailSettingsRequest,
)
from models.errors import error_responses
from models.feedback import FeedbackItem, SetHandledRequest, SetHandledResponse
from services.admin_service import AdminService
from services.admin_types import CrewRow, MemberRow
from services.email_service import Audience, EmailService
from services.feedback_service import FeedbackService
from services.member import Member
from settings import Settings

router = APIRouter(
    prefix="/admin",
    tags=["Admin"],
    dependencies=[Depends(get_current_admin)],
    responses=error_responses(401, 403),
)


def _crew(row: CrewRow, admin: AdminService) -> AdminCrewResponse:
    crew = row.crew
    return AdminCrewResponse(
        id=crew.id,
        name=crew.name,
        time_zone=crew.time_zone,
        invite_code=crew.invite_code,
        invite_uses=crew.invite_uses,
        invite_max_uses=crew.invite_max_uses,
        invite_expires_at=crew.invite_expires_at,
        invite_status=admin.invite_status(crew),  # type: ignore[arg-type]
        members=row.members,
        points=row.points,
    )


def _member(row: MemberRow, settings: Settings) -> AdminMemberResponse:
    user = row.user
    return AdminMemberResponse(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        initials=user.initials,
        avatar_url=avatar_url(user),
        color=user.color,  # type: ignore[arg-type]
        crew_name=row.crew.name if row.crew else None,
        points=row.points,
        workouts=row.workouts,
        last_workout_at=row.last_workout_at,
        created_at=user.created_at,
        is_admin=settings.is_admin(user.email),
    )


@router.get("/overview", response_model=OverviewResponse)
async def overview(admin: AdminService = Depends(get_admin_service)) -> OverviewResponse:
    """Totals, and the last seven days."""
    return OverviewResponse.model_validate(await admin.overview())


@router.get("/crews", response_model=list[AdminCrewResponse])
async def crews(admin: AdminService = Depends(get_admin_service)) -> list[AdminCrewResponse]:
    """Every crew with its invite code."""
    return [_crew(row, admin) for row in await admin.crews()]


@router.post(
    "/crews",
    status_code=status.HTTP_201_CREATED,
    response_model=AdminCrewResponse,
    responses=error_responses(409, 422),
)
async def create_crew(
    body: CreateCrewRequest,
    user: User = Depends(get_current_admin),
    admin: AdminService = Depends(get_admin_service),
) -> AdminCrewResponse:
    """Create a crew, with a chosen invite code and limits or a random code and none."""
    invite = body.model_dump(include={"invite_code", "invite_max_uses", "invite_expires_at"})
    crew = await admin.create_crew(user, body.name, body.time_zone, invite)
    return _crew(CrewRow(crew, 0, 0), admin)


@router.patch(
    "/crews/{crew_id}", response_model=AdminCrewResponse, responses=error_responses(404, 409, 422)
)
async def update_crew(
    crew_id: uuid.UUID,
    body: UpdateCrewRequest,
    user: User = Depends(get_current_admin),
    admin: AdminService = Depends(get_admin_service),
) -> AdminCrewResponse:
    """Change a crew's name, time zone, invite code or invite limits. Only sent fields change."""
    crew = await admin.update_crew(user, crew_id, body.model_dump(exclude_unset=True))
    row = next(r for r in await admin.crews() if r.crew.id == crew.id)
    return _crew(row, admin)


@router.post(
    "/crews/{crew_id}/invite-code",
    response_model=AdminCrewResponse,
    responses=error_responses(404),
)
async def rotate_invite_code(
    crew_id: uuid.UUID,
    user: User = Depends(get_current_admin),
    admin: AdminService = Depends(get_admin_service),
) -> AdminCrewResponse:
    """Replace the invite code. The old one stops working."""
    crew = await admin.rotate_invite_code(user, crew_id)
    row = next(r for r in await admin.crews() if r.crew.id == crew.id)
    return _crew(row, admin)


@router.post(
    "/crews/{crew_id}/invites",
    response_model=InviteSentResponse,
    responses=error_responses(404, 409),
)
async def send_invite(
    crew_id: uuid.UUID,
    body: SendInviteRequest,
    user: User = Depends(get_current_admin),
    admin: AdminService = Depends(get_admin_service),
) -> InviteSentResponse:
    """Email someone the crew's invite link. They join when they open it and sign in."""
    sent = await admin.send_invite(user, crew_id, body.email, body.language)
    return InviteSentResponse.model_validate(sent)


@router.get("/members", response_model=list[AdminMemberResponse])
async def members(
    search: str | None = None,
    admin: AdminService = Depends(get_admin_service),
    settings: Settings = Depends(get_settings),
) -> list[AdminMemberResponse]:
    """Accounts, optionally filtered by name or email."""
    return [_member(row, settings) for row in await admin.members(search)]


@router.post(
    "/members/{user_id}/points",
    status_code=status.HTTP_204_NO_CONTENT,
    responses=error_responses(404, 409),
)
async def adjust_points(
    user_id: uuid.UUID,
    body: AdjustPointsRequest,
    user: User = Depends(get_current_admin),
    admin: AdminService = Depends(get_admin_service),
) -> None:
    """Add or remove points, with a reason."""
    await admin.adjust_points(user, user_id, body.points, body.reason)


@router.delete(
    "/members/{user_id}/crew",
    status_code=status.HTTP_204_NO_CONTENT,
    responses=error_responses(404),
)
async def remove_from_crew(
    user_id: uuid.UUID,
    user: User = Depends(get_current_admin),
    admin: AdminService = Depends(get_admin_service),
) -> None:
    """Take a member out of their crew. The account and history stay."""
    await admin.remove_from_crew(user, user_id)


@router.delete(
    "/members/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses=error_responses(404, 409),
)
async def delete_account(
    user_id: uuid.UUID,
    user: User = Depends(get_current_admin),
    admin: AdminService = Depends(get_admin_service),
) -> None:
    """Delete an account and everything in it. This can't be undone."""
    await admin.delete_account(user, user_id)


async def _email_settings(email: EmailService, app: Settings) -> EmailSettingsResponse:
    decided = await email.settings()
    return EmailSettingsResponse(
        welcome_enabled=decided.welcome_enabled,
        digest_enabled=decided.digest_enabled,
        digest_hour=decided.digest_hour,
        configured=bool(app.resend_api_key),
        sender=app.email_from,
        digests_sent_this_week=await email.digests_sent_this_week(),
    )


@router.get("/email", response_model=EmailSettingsResponse)
async def email_settings(
    email: EmailService = Depends(get_email_service),
    app_settings: Settings = Depends(get_settings),
) -> EmailSettingsResponse:
    """Email settings, and whether email can go out at all."""
    return await _email_settings(email, app_settings)


@router.patch("/email", response_model=EmailSettingsResponse, responses=error_responses(422))
async def update_email_settings(
    body: UpdateEmailSettingsRequest,
    admin: User = Depends(get_current_admin),
    email: EmailService = Depends(get_email_service),
    app_settings: Settings = Depends(get_settings),
) -> EmailSettingsResponse:
    """Turn the welcome email and weekly digest on or off, and choose the digest's hour."""
    await email.update_settings(admin, body.welcome_enabled, body.digest_enabled, body.digest_hour)
    return await _email_settings(email, app_settings)


@router.post(
    "/email/message", response_model=MessageResultResponse, responses=error_responses(404, 422)
)
async def send_message(
    body: SendMessageRequest,
    admin: User = Depends(get_current_admin),
    email: EmailService = Depends(get_email_service),
) -> MessageResultResponse:
    """Write to everyone, one crew or one person. `dry_run` only counts who it would reach."""
    audience = Audience(crew_id=body.crew_id, email=body.email)
    if body.dry_run:
        reach = await email.audience_size(audience, body.template)
        return MessageResultResponse(recipients=reach, sent=0)
    if body.template is not None:
        recipients, sent = await email.send_template(admin, audience, body.template)
    else:
        assert body.subject is not None and body.html is not None
        recipients, sent = await email.send_message(
            admin, audience, body.subject, body.html, body.full_document
        )
    return MessageResultResponse(recipients=recipients, sent=sent)


@router.get("/email/templates", response_model=list[EmailTemplateResponse])
async def email_templates(
    language: Literal["en", "es"] = "en",
    email: EmailService = Depends(get_email_service),
) -> list[EmailTemplateResponse]:
    """Every email GYMBROS sends, with tags where each person's details go."""
    return [
        EmailTemplateResponse(id=t.id, subject=t.subject, html=t.html, live=t.live)
        for t in email.templates(language)
    ]


@router.post("/email/preview", response_model=PreviewResponse, responses=error_responses(422))
async def preview_email(
    body: PreviewRequest,
    admin: User = Depends(get_current_admin),
    email: EmailService = Depends(get_email_service),
) -> PreviewResponse:
    """A message as it will reach you."""
    return PreviewResponse(html=email.preview(admin, body.html, body.full_document))


@router.post(
    "/email/test-digest", response_model=TestDigestResponse, responses=error_responses(409)
)
async def send_test_digest(
    member: Member = Depends(get_current_member),
    email: EmailService = Depends(get_email_service),
) -> TestDigestResponse:
    """Send yourself this week's digest, to see how it looks."""
    return TestDigestResponse(sent=await email.send_test_digest(member))


def _feedback_item(feedback: Feedback, user: User) -> FeedbackItem:
    return FeedbackItem(
        id=feedback.id,
        kind=feedback.kind,  # type: ignore[arg-type]
        body=feedback.body,
        created_at=feedback.created_at,
        handled=feedback.handled_at is not None,
        display_name=user.display_name,
        email=user.email,
    )


@router.get("/feedback", response_model=list[FeedbackItem])
async def feedback_inbox(
    feedback: FeedbackService = Depends(get_feedback_service),
) -> list[FeedbackItem]:
    """What members have sent, newest first."""
    return [_feedback_item(item, user) for item, user in await feedback.inbox()]


@router.patch(
    "/feedback/{feedback_id}", response_model=SetHandledResponse, responses=error_responses(404)
)
async def set_feedback_handled(
    feedback_id: uuid.UUID,
    body: SetHandledRequest,
    admin: User = Depends(get_current_admin),
    feedback: FeedbackService = Depends(get_feedback_service),
) -> SetHandledResponse:
    """Mark a message as dealt with, or not any more."""
    item = await feedback.set_handled(admin, feedback_id, body.handled)
    return SetHandledResponse(handled=item.handled_at is not None)


@router.get("/actions", response_model=list[AdminActionResponse])
async def actions(admin: AdminService = Depends(get_admin_service)) -> list[AdminActionResponse]:
    """The audit log, newest first."""
    return [AdminActionResponse.model_validate(row) for row in await admin.actions()]

"""What the backoffice decides about email, the weekly digest and messages from admins."""

import uuid
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timedelta
from logging import Logger
from zoneinfo import ZoneInfo

from db.repositories.admin_repository import AdminRepository
from db.repositories.crew_repository import CrewRepository
from db.repositories.email_repository import EmailRepository
from db.repositories.point_event_repository import PointEventRepository
from db.repositories.user_repository import UserRepository
from db.tables.admin_action import AdminAction
from db.tables.crew import Crew
from db.tables.email_settings import EmailSettings
from db.tables.user import User
from services.errors import CrewNotFound, MemberNotFound, NothingToDigest
from services.member import Member
from services.recap_service import Recap, RecapService
from services.training_rules import week_start
from services.unsubscribe import token_is_valid, unsubscribe_query
from services.email_templates import DIGEST, EmailTemplate, all_templates
from services.update_email import (
    DigestNumbers,
    Recipient,
    admin_email,
    digest_email,
    stop_headers,
)
from services.welcome_email import (
    EmailMessage,
    EmailSender,
    GameNumbers,
    StopLinks,
    welcome_email,
)

MONDAY = 0


def digest_is_due(now: datetime, time_zone: str, hour: int) -> bool:
    """On Monday from the chosen hour, in the crew's time. Later on Monday still catches up."""
    local = now.astimezone(ZoneInfo(time_zone))
    return local.weekday() == MONDAY and local.hour >= hour


@dataclass(frozen=True, slots=True)
class EmailLinks:
    """What links in emails need."""

    public_url: str
    secret: str
    numbers: GameNumbers


@dataclass(frozen=True, slots=True)
class Audience:
    """Who a message from the backoffice goes to. Both empty: everyone."""

    crew_id: uuid.UUID | None = None
    email: str | None = None


class EmailService:
    # pylint: disable=too-many-instance-attributes
    """Everything about email except sending it, which is the EmailSender's."""

    def __init__(  # pylint: disable=too-many-arguments,too-many-positional-arguments
        self,
        repos: tuple[
            EmailRepository, CrewRepository, UserRepository, PointEventRepository, AdminRepository
        ],
        recap: RecapService,
        sender: EmailSender,
        links: EmailLinks,
        now: Callable[[], datetime],
        logger: Logger,
    ) -> None:
        self._email, self._crews, self._users, self._events, self._admin = repos
        self._recap = recap
        self._sender = sender
        self._links = links
        self._now = now
        self._logger = logger

    async def settings(self) -> EmailSettings:
        """What the backoffice has decided."""
        return await self._email.settings()

    async def digests_sent_this_week(self) -> int:
        """How many digests went out for the week that just ended, across crews."""
        since = (self._now() - timedelta(days=8)).date()
        return await self._email.digests_sent(since)

    async def update_settings(
        self, admin: User, welcome: bool | None, digest: bool | None, hour: int | None
    ) -> EmailSettings:
        """Change what the backoffice decides. Logged like any backoffice change."""
        settings = await self._email.settings()
        if welcome is not None:
            settings.welcome_enabled = welcome
        if digest is not None:
            settings.digest_enabled = digest
        if hour is not None:
            settings.digest_hour = hour
        await self._email.save()
        await self._audit(
            admin,
            "email_settings",
            {"reason": f"digest={settings.digest_enabled}, welcome={settings.welcome_enabled}"},
        )
        return settings

    # ---- Messages from admins

    def templates(self, language: str) -> tuple[EmailTemplate, ...]:
        """Every email GYMBROS sends, to start from."""
        return all_templates(language, self._links.numbers)

    def preview(self, admin: User, html: str, full_document: bool) -> str:
        """How a message looks when it reaches the admin writing it."""
        return admin_email(
            self._recipient(admin), "", html, self._links.public_url, full_document
        ).html

    async def audience_size(self, audience: Audience, template: str | None = None) -> int:
        """How many people a message would reach."""
        if template == DIGEST:
            return len(await self._crew_members(audience))
        return len(await self._audience(audience))

    async def send_message(  # pylint: disable=too-many-arguments,too-many-positional-arguments
        self, admin: User, audience: Audience, subject: str, html: str, full_document: bool
    ) -> tuple[int, int]:
        """Send to everyone in the audience. Returns (recipients, how many went out)."""
        users = await self._audience(audience)
        messages = [
            admin_email(self._recipient(u), subject, html, self._links.public_url, full_document)
            for u in users
        ]
        sent = await self._sender.send_many(messages)
        # The subject, not who got it or what it said: the log keeps no personal data.
        await self._audit(
            admin, "email_sent", {"reason": subject, "points": sent}, target=audience.crew_id
        )
        return len(users), sent

    async def send_template(
        self, admin: User, audience: Audience, template: str
    ) -> tuple[int, int]:
        """Send an email as GYMBROS makes it: each person's own, in their language."""
        if template == DIGEST:
            members = await self._crew_members(audience)
            messages = [await self._digest(member) for member in members]
        else:
            messages = [self._welcome(user) for user in await self._audience(audience)]
        sent = await self._sender.send_many(messages)
        await self._audit(
            admin, "email_sent", {"reason": template, "points": sent}, target=audience.crew_id
        )
        return len(messages), sent

    async def _crew_members(self, audience: Audience) -> list[Member]:
        """The audience, without anyone not in a crew: a digest has nothing to say to them."""
        members = []
        for user in await self._audience(audience):
            crew = await self._crews.get_crew_of(user.id)
            if crew is not None:
                members.append(Member(user, crew))
        return members

    def _welcome(self, user: User) -> EmailMessage:
        stop = StopLinks(self._stop_url(user), stop_headers(self._one_click_url(user)))
        return welcome_email(
            user.email,
            user.display_name,
            user.language,
            self._links.public_url,
            self._links.numbers,
            stop,
        )

    def _recipient(self, user: User) -> Recipient:
        return Recipient(
            user.email,
            user.display_name,
            user.language,
            self._stop_url(user),
            self._one_click_url(user),
        )

    async def _audience(self, audience: Audience) -> list[User]:
        if audience.email is not None:
            user = await self._users.get_by_email(audience.email.strip().lower())
            if user is None:
                raise MemberNotFound(audience.email)
            return [user] if user.email_updates else []
        if audience.crew_id is not None and await self._crews.get(audience.crew_id) is None:
            raise CrewNotFound(str(audience.crew_id))
        return await self._email.recipients(audience.crew_id)

    # ---- The weekly digest

    async def send_due_digests(self) -> int:
        """Send what's due, if the digest is on. Runs every few minutes, on every server worker:
        a claim per member and week means each digest goes out once."""
        settings = await self._email.settings()
        if not settings.digest_enabled:
            return 0
        now = self._now()
        sent = 0
        for crew in await self._email.crews():
            if digest_is_due(now, crew.time_zone, settings.digest_hour):
                sent += await self._send_crew_digest(crew, now)
        return sent

    async def _send_crew_digest(self, crew: Crew, now: datetime) -> int:
        this_week = week_start(now, crew.time_zone)
        last_week = this_week - timedelta(weeks=1)
        points = await self._events.totals_by_user(crew.id, last_week)
        if not any(points.values()):
            return 0  # A quiet week isn't worth an email.
        claimed: list[User] = []
        for user in await self._email.recipients(crew.id):
            if await self._email.claim_digest(user.id, this_week, now):
                claimed.append(user)
        if not claimed:
            return 0
        messages = [await self._digest(Member(user, crew)) for user in claimed]
        sent = await self._sender.send_many(messages)
        if sent == 0:
            await self._email.release_digest([u.id for u in claimed], this_week)
            self._logger.warning("Weekly digest not sent for a crew; it will try again")
        return sent

    async def send_test_digest(self, member: Member) -> bool:
        """A digest for the admin asking for one, whatever the settings say."""
        points = await self._events.totals_by_user(
            member.crew.id, week_start(self._now(), member.crew.time_zone) - timedelta(weeks=1)
        )
        if not any(points.values()):
            raise NothingToDigest(str(member.crew.id))
        return await self._sender.send(await self._digest(member))

    async def _digest(self, member: Member) -> EmailMessage:
        recap = await self._recap.recap(member)
        return digest_email(
            member.user.email,
            member.user.language,
            self._numbers(member.user, recap),
            self._links.public_url,
            self._stop_url(member.user),
            self._one_click_url(member.user),
        )

    @staticmethod
    def _numbers(user: User, recap: Recap) -> DigestNumbers:
        climber = recap.biggest_climber
        pr = recap.heaviest_pr
        return DigestNumbers(
            name=user.display_name,
            points=recap.my_points,
            workouts=recap.my_workouts,
            target=recap.weekly_target,
            crew_total=recap.crew_total,
            climber=(climber[0].display_name, climber[1]) if climber else None,
            pr=(pr.user.display_name, pr.load_kg) if pr else None,
        )

    # ---- Unsubscribing

    async def unsubscribe(self, user_id: uuid.UUID, token: str) -> bool:
        """Turn off email updates, from a link. Says whether the link was good."""
        if not token_is_valid(user_id, token, self._links.secret):
            return False
        user = await self._users.get(user_id)
        if user is None:
            return False
        user.email_updates = False
        await self._users.save(user)
        return True

    def _stop_url(self, user: User) -> str:
        query = unsubscribe_query(user.id, self._links.secret)
        return f"{self._links.public_url}/unsubscribe?{query}"

    def _one_click_url(self, user: User) -> str:
        query = unsubscribe_query(user.id, self._links.secret)
        return f"{self._links.public_url}/api/email/unsubscribe?{query}"

    async def _audit(
        self,
        admin: User,
        action: str,
        details: dict[str, object],
        target: uuid.UUID | None = None,
    ) -> None:
        await self._admin.log(
            AdminAction(
                admin_id=admin.id,
                admin_email=admin.email,
                action=action,
                target=str(target or admin.id),
                details=details,
                created_at=self._now(),
            )
        )

"""Duels: a 1v1 until Sunday night by points or bench volume. Settled lazily after the week."""

import uuid
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime

from db.repositories.crew_repository import CrewRepository
from db.repositories.duel_repository import DuelRepository
from db.repositories.point_event_repository import PointEventRepository
from db.repositories.user_repository import UserRepository
from db.repositories.workout_stats_repository import WorkoutStatsRepository
from db.tables.duel import Duel
from db.tables.point_event import PointEvent
from db.tables.user import User
from services.errors import (
    CannotDuelSelf,
    DuelExists,
    DuelNotFound,
    DuelNotPending,
    MemberNotFound,
)
from services.member import Member
from services.notifier import Notifier
from services.training_rules import week_start

DUEL_KEY = "ln_duel"


@dataclass(frozen=True, slots=True)
class DuelView:
    """A duel with both sides and their current numbers."""

    duel: Duel
    challenger: User
    opponent: User
    challenger_value: float
    opponent_value: float


class DuelService:
    # pylint: disable=too-many-instance-attributes
    """Creates, answers, lists and settles duels."""

    def __init__(
        self,
        repos: tuple[
            DuelRepository,
            PointEventRepository,
            WorkoutStatsRepository,
            CrewRepository,
            UserRepository,
        ],
        notifier: Notifier,
        win_points: int,
        now: Callable[[], datetime],
    ) -> None:
        self._duels, self._events, self._stats, self._crews, self._users = repos
        self._notifier = notifier
        self._win_points = win_points
        self._now = now

    async def challenge(
        self, member: Member, opponent_id: uuid.UUID, metric: str, stake: str
    ) -> DuelView:
        """Invite a crew mate to a duel this week."""
        if opponent_id == member.user.id:
            raise CannotDuelSelf(str(opponent_id))
        opponent = await self._crew_member(member, opponent_id)
        week = week_start(self._now(), member.crew.time_zone)
        if await self._duels.open_between(member.user.id, opponent_id, week) is not None:
            raise DuelExists(str(opponent_id))
        duel = await self._duels.add(
            Duel(
                crew_id=member.crew.id,
                challenger_id=member.user.id,
                opponent_id=opponent_id,
                metric=metric,
                stake_key=stake,
                week_start=week,
                status="pending",
                created_at=self._now(),
            )
        )
        name = {"name": member.user.display_name}
        await self._notifier.send([opponent_id], member.user.id, "n_duel_invite", name, "/quests")
        return await self._view(duel, member.user, opponent)

    async def respond(self, member: Member, duel_id: uuid.UUID, accept: bool) -> DuelView:
        """The opponent accepts or declines a pending duel."""
        duel = await self._duels.get(duel_id)
        if duel is None or duel.opponent_id != member.user.id:
            raise DuelNotFound(str(duel_id))
        if duel.status != "pending":
            raise DuelNotPending(str(duel_id))
        duel.status = "active" if accept else "declined"
        await self._duels.save(duel)
        key = "n_duel_accepted" if accept else "n_duel_declined"
        name = {"name": member.user.display_name}
        await self._notifier.send([duel.challenger_id], member.user.id, key, name, "/quests")
        challenger = await self._crew_member(member, duel.challenger_id)
        return await self._view(duel, challenger, member.user)

    async def views(self, member: Member) -> list[DuelView]:
        """This week's duels for the member (settling any that have ended first)."""
        await self.settle_due(member)
        week = week_start(self._now(), member.crew.time_zone)
        users = {u.id: u for u in await self._crews.members(member.crew.id)}
        return [
            await self._view(d, users[d.challenger_id], users[d.opponent_id])
            for d in await self._duels.involving(member.user.id, week)
            if d.challenger_id in users and d.opponent_id in users
        ]

    async def settle_due(self, member: Member) -> None:
        """Pay the winners of accepted duels whose week is over. Ties pay nobody."""
        this_week = week_start(self._now(), member.crew.time_zone)
        for duel in await self._duels.due_for_settlement(member.crew.id, this_week):
            mine = await self._value(duel, duel.challenger_id)
            theirs = await self._value(duel, duel.opponent_id)
            winner = (
                duel.challenger_id if mine > theirs else duel.opponent_id if theirs > mine else None
            )
            duel.status, duel.winner_id, duel.settled_at = "settled", winner, self._now()
            await self._duels.save(duel)
            if winner is not None:
                await self._pay(member, duel, winner, this_week)

    async def _pay(self, member: Member, duel: Duel, winner: uuid.UUID, week) -> None:
        loser = duel.opponent_id if winner == duel.challenger_id else duel.challenger_id
        names = await self._users.get_many({winner, loser})
        await self._events.add_all(
            [
                PointEvent(
                    user_id=winner,
                    crew_id=member.crew.id,
                    key=DUEL_KEY,
                    vars={"name": names[loser].display_name},
                    points=self._win_points,
                    week_start=week,
                    created_at=self._now(),
                )
            ]
        )
        await self._notifier.send(
            [winner], None, "n_duel_won", {"name": names[loser].display_name}, "/quests"
        )

    async def _value(self, duel: Duel, user_id: uuid.UUID) -> float:
        if duel.metric == "bench_volume":
            return await self._stats.exercise_volume_in_week(user_id, "bench", duel.week_start)
        return float(await self._events.week_points_excluding(user_id, duel.week_start, DUEL_KEY))

    async def _view(self, duel: Duel, challenger: User, opponent: User) -> DuelView:
        return DuelView(
            duel,
            challenger,
            opponent,
            await self._value(duel, challenger.id),
            await self._value(duel, opponent.id),
        )

    async def _crew_member(self, member: Member, user_id: uuid.UUID) -> User:
        found = next(
            (u for u in await self._crews.members(member.crew.id) if u.id == user_id), None
        )
        if found is None:
            raise MemberNotFound(str(user_id))
        return found

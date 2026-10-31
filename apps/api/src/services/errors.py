"""Domain exceptions. Services raise these; routes map them to HTTP status codes."""


class DomainError(Exception):
    """Base class for every expected business-rule failure."""


class InvalidCredentials(DomainError):
    """Email and password don't match an account."""


class NotAuthenticated(DomainError):
    """No valid session."""


class EmailAlreadyRegistered(DomainError):
    """An account with this email exists."""


class InviteCodeNotFound(DomainError):
    """No crew has this invite code."""


class AlreadyInCrew(DomainError):
    """The user already belongs to a crew (one crew per user)."""


class InvalidTimeZone(DomainError):
    """Not an IANA time zone name."""


class NotInCrew(DomainError):
    """The user has to join a crew first."""


class WorkoutNotFound(DomainError):
    """No such workout for this user."""


class WorkoutAlreadyActive(DomainError):
    """The user already has a workout in progress."""


class WorkoutAlreadyFinished(DomainError):
    """The workout is finished and can't change."""


class WorkoutEmpty(DomainError):
    """A workout needs at least one completed set to be finished."""


class UnknownExercise(DomainError):
    """Not an exercise in the catalog."""


class UnknownRoutine(DomainError):
    """Not a routine in the catalog."""


class FeedItemNotFound(DomainError):
    """No such feed item in the member's crew."""


class OwnFeedItem(DomainError):
    """Members can't react to their own posts."""


class MemberNotFound(DomainError):
    """No such member in the crew."""


class CannotNudgeSelf(DomainError):
    """Nudges are for other members."""


class AlreadyNudged(DomainError):
    """One nudge per member per day."""


class CannotDuelSelf(DomainError):
    """Duels are against someone else."""


class DuelExists(DomainError):
    """There's already an open duel between the two this week."""


class DuelNotFound(DomainError):
    """No such duel for this member."""


class DuelNotPending(DomainError):
    """The duel was already accepted, declined or settled."""


class UnknownExerciseForHistory(DomainError):
    """PR history is only for catalog lifts."""

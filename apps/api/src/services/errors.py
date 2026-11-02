"""Domain exceptions. Services raise these; routes map them to HTTP status codes."""


class DomainError(Exception):
    """Base class for every expected business-rule failure."""


class GoogleSignInFailed(DomainError):
    """The Google sign-in couldn't be completed. The message is for the log, never the user."""


class AdminRequired(DomainError):
    """Only admins may do this."""


class CrewNotFound(DomainError):
    """No such crew."""


class MemberHasNoCrew(DomainError):
    """Points belong to a crew, and this member isn't in one."""


class CannotDeleteSelf(DomainError):
    """Admins delete their own account from their settings, not the backoffice."""


class DeleteNotConfirmed(DomainError):
    """The confirmation typed doesn't match the account's email."""


class NothingToDigest(DomainError):
    """The crew did nothing last week, so there's no digest to show."""


class FeedbackNotFound(DomainError):
    """No such message."""


class TooMuchFeedback(DomainError):
    """There's a daily limit to how many messages a member can send."""


class WorkoutPhotoNotFound(DomainError):
    """No such photo, or not one you can see."""


class InvalidAvatarText(DomainError):
    """A profile picture can be up to two characters, and they have to be visible."""


class AvatarNotFound(DomainError):
    """No such picture, or not one you can see."""


class ImageTooLarge(DomainError):
    """The upload is bigger than this kind of image may be."""


class ImageNotSupported(DomainError):
    """The upload isn't a JPEG, PNG or WebP picture."""


class GymNotFound(DomainError):
    """No such gym of yours."""


class GymNameTaken(DomainError):
    """You already have a gym with this name."""


class TooManyGyms(DomainError):
    """There's a limit to how many gyms a member can have."""


class StretchingAlreadyLogged(DomainError):
    """Stretching pays once a day, and this session has nothing else in it."""


class WorkoutDateOutOfRange(DomainError):
    """A past workout has to be for one of the last few days, not today or further back."""


class NotAuthenticated(DomainError):
    """No valid session."""


class InviteCodeNotFound(DomainError):
    """No crew has this invite code."""


class InviteCodeExpired(DomainError):
    """This invite code's time ran out."""


class InviteCodeUsedUp(DomainError):
    """This invite code has reached its maximum uses."""


class InviteCodeInvalid(DomainError):
    """A custom invite code must be 4 to 12 letters and digits."""


class InviteCodeTaken(DomainError):
    """Another crew already uses this invite code."""


class InviteExpiryInPast(DomainError):
    """An invite can't expire in the past."""


class AlreadyInThisCrew(DomainError):
    """The person being invited is already in this crew."""


class MemberInOtherCrew(DomainError):
    """The person being invited is in another crew, and it's one crew per person."""


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

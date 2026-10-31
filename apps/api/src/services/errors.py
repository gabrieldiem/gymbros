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

"""Domain exception → HTTP error with a machine-readable code (`{"detail": {"code": ...}}`)."""

from fastapi import Request, status
from fastapi.responses import JSONResponse

from services.errors import (
    AlreadyInCrew,
    EmailAlreadyRegistered,
    InvalidCredentials,
    InvalidTimeZone,
    InviteCodeNotFound,
    NotAuthenticated,
)

_STATUS_AND_CODE: dict[type[Exception], tuple[int, str]] = {
    InvalidCredentials: (status.HTTP_401_UNAUTHORIZED, "invalid_credentials"),
    NotAuthenticated: (status.HTTP_401_UNAUTHORIZED, "not_authenticated"),
    EmailAlreadyRegistered: (status.HTTP_409_CONFLICT, "email_taken"),
    InviteCodeNotFound: (status.HTTP_404_NOT_FOUND, "invite_code_not_found"),
    AlreadyInCrew: (status.HTTP_409_CONFLICT, "already_in_crew"),
    InvalidTimeZone: (status.HTTP_422_UNPROCESSABLE_CONTENT, "invalid_time_zone"),
}


async def handle_domain_error(_request: Request, error: Exception) -> JSONResponse:
    """Registered on the app for DomainError. Unmapped domain errors are a bug: re-raise."""
    mapped = _STATUS_AND_CODE.get(type(error))
    if mapped is None:
        raise error
    status_code, code = mapped
    return JSONResponse(status_code=status_code, content={"detail": {"code": code}})

"""Error bodies. The API sends a machine code; the web app turns it into copy with t()."""

from typing import Any, Dict

from pydantic import BaseModel


class ErrorDetail(BaseModel):
    """`{"code": "invalid_credentials"}`"""

    code: str


class ErrorResponse(BaseModel):
    """FastAPI's error envelope with a coded detail."""

    detail: ErrorDetail


def error_responses(*statuses: int) -> Dict[int | str, Dict[str, Any]]:
    """OpenAPI `responses=` entries for coded errors."""
    return {status: {"model": ErrorResponse} for status in statuses}

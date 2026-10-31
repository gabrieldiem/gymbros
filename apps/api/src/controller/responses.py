"""Common response examples for the general endpoints."""

from typing import Any, Dict

ROOT_RESPONSES: Dict[int | str, Dict[str, Any]] = {
    200: {
        "description": "Service is running correctly",
        "content": {"application/json": {"example": {"status": "ok", "service": "gymbros-api"}}},
    }
}

HEALTH_RESPONSES: Dict[int | str, Dict[str, Any]] = {
    200: {
        "description": "Service and database are up",
        "content": {"application/json": {"example": {"status": "running", "database": "up"}}},
    },
    503: {
        "description": "Service is up but the database is unreachable",
        "content": {"application/json": {"example": {"status": "degraded", "database": "down"}}},
    },
}

"""Password hashing with argon2id. Hashing is CPU-bound, so it runs in a worker thread."""

import asyncio
from typing import Protocol

from argon2 import PasswordHasher as Argon2
from argon2.exceptions import InvalidHashError, VerificationError


class PasswordHasher(Protocol):
    """Hash and verify passwords."""

    async def hash(self, password: str) -> str:
        """Return a self-describing hash of the password."""

    async def verify(self, password_hash: str, password: str) -> bool:
        """Whether the password matches the hash."""


class Argon2PasswordHasher:
    """argon2id with the library's recommended parameters."""

    def __init__(self, argon2: Argon2 | None = None) -> None:
        self._argon2 = argon2 or Argon2()

    async def hash(self, password: str) -> str:
        """Return an argon2id hash."""
        return await asyncio.to_thread(self._argon2.hash, password)

    async def verify(self, password_hash: str, password: str) -> bool:
        """Whether the password matches. Malformed hashes never match."""
        try:
            return await asyncio.to_thread(self._argon2.verify, password_hash, password)
        except (VerificationError, InvalidHashError):
            return False

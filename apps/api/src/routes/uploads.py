"""Reading an uploaded file, without keeping more of it than the limit allows."""

from fastapi import Request

from services.errors import ImageTooLarge


async def read_upload(request: Request, max_bytes: int) -> bytes:
    """The request's body. Stops reading, and raises, as soon as it passes `max_bytes`."""
    data = bytearray()
    async for chunk in request.stream():
        data += chunk
        if len(data) > max_bytes:
            raise ImageTooLarge(str(len(data)))
    return bytes(data)

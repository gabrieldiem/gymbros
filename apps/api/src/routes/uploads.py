"""Reading an uploaded file, without keeping more of it than the limit allows."""

from fastapi import Request, Response

from services.errors import ImageTooLarge
from services.images import image_file_name

_A_YEAR = 60 * 60 * 24 * 365


async def read_upload(request: Request, max_bytes: int) -> bytes:
    """The request's body. Stops reading, and raises, as soon as it passes `max_bytes`."""
    data = bytearray()
    async for chunk in request.stream():
        data += chunk
        if len(data) > max_bytes:
            raise ImageTooLarge(str(len(data)))
    return bytes(data)


def image_response(data: bytes, content_type: str) -> Response:
    """A stored image. Its URL changes with each upload, so it can be cached for good, and saving
    it gets a name that says nothing about who it's from."""
    return Response(
        content=data,
        media_type=content_type,
        headers={
            "Cache-Control": f"private, max-age={_A_YEAR}, immutable",
            "Content-Disposition": f'inline; filename="{image_file_name(data, content_type)}"',
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "default-src 'none'; sandbox",
        },
    )

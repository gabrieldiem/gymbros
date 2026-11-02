"""Uploaded images: only what a browser shows as a picture, recognized by its bytes."""

from services.errors import ImageNotSupported, ImageTooLarge

MAX_AVATAR_BYTES = 300 * 1024


def image_type(data: bytes) -> str | None:
    """The content type these bytes really are. Never trust the one the client sent."""
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None


def check_image(data: bytes, max_bytes: int) -> str:
    """The content type of a valid upload. Raises if it's too big or not a picture."""
    if len(data) > max_bytes:
        raise ImageTooLarge(str(len(data)))
    content_type = image_type(data)
    if content_type is None:
        raise ImageNotSupported()
    return content_type

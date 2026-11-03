"""Uploaded images: only what a browser shows as a picture, recognized by its bytes, and rebuilt
from its pixels so that nothing else in the file survives: no location, camera, dates or names."""

import hashlib
import io
from dataclasses import dataclass

from PIL import Image, ImageOps, UnidentifiedImageError

from services.errors import ImageNotSupported, ImageTooLarge

MAX_AVATAR_BYTES = 300 * 1024
MAX_PHOTO_BYTES = 2 * 1024 * 1024
# Far past any phone, and it stops a small file that unpacks into an enormous picture.
_MAX_PIXELS = 50_000_000
_QUALITIES = (90, 80, 70)
_FORMATS = {"JPEG": "image/jpeg", "PNG": "image/png", "WEBP": "image/webp"}
_EXTENSIONS = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}


@dataclass(frozen=True, slots=True)
class CleanImage:
    """A picture with nothing in it but pixels."""

    data: bytes
    content_type: str


def image_type(data: bytes) -> str | None:
    """The content type these bytes really are. Never trust the one the client sent."""
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None


def _pixels_only(image: Image.Image) -> Image.Image:
    """A new image from the pixels alone, upright, so no metadata can come along with it."""
    upright = ImageOps.exif_transpose(image)
    has_alpha = upright.mode in ("RGBA", "LA", "PA") or "transparency" in upright.info
    if upright.mode not in ("RGB", "RGBA", "L"):
        upright = upright.convert("RGBA" if has_alpha else "RGB")
    return Image.frombytes(upright.mode, upright.size, upright.tobytes())


def _encode(image: Image.Image, image_format: str, quality: int) -> bytes:
    if image_format == "JPEG" and image.mode == "RGBA":
        image = image.convert("RGB")
    output = io.BytesIO()
    image.save(output, format=image_format, quality=quality, optimize=True)
    return output.getvalue()


def clean_image(data: bytes, max_bytes: int) -> CleanImage:
    """A valid upload with everything but its pixels gone. Raises if it's too big or isn't a
    picture. It decodes the image, so call it off the event loop."""
    if len(data) > max_bytes:
        raise ImageTooLarge(str(len(data)))
    if image_type(data) is None:
        raise ImageNotSupported()
    try:
        with Image.open(io.BytesIO(data), formats=tuple(_FORMATS)) as image:
            if image.width * image.height > _MAX_PIXELS:
                raise ImageNotSupported()
            pixels = _pixels_only(image)
            image_format = str(image.format)
    except (UnidentifiedImageError, OSError, ValueError, SyntaxError) as error:
        raise ImageNotSupported() from error
    for quality in _QUALITIES:
        cleaned = _encode(pixels, image_format, quality)
        if len(cleaned) <= max_bytes:
            return CleanImage(cleaned, _FORMATS[image_format])
    raise ImageTooLarge(str(len(cleaned)))


def image_file_name(data: bytes, content_type: str) -> str:
    """The same kind of name for every image, which says nothing about who or what it shows."""
    digest = hashlib.sha256(data).hexdigest()[:24]
    return f"gymbros-{digest}.{_EXTENSIONS.get(content_type, 'img')}"

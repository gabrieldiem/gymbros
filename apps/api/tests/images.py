"""Real pictures for tests, because the server opens every upload."""

import io

from PIL import Image


def picture(image_format: str = "JPEG", size: tuple[int, int] = (8, 8), **save) -> bytes:
    """A small, valid image."""
    output = io.BytesIO()
    Image.new("RGB", size, (200, 30, 30)).save(output, format=image_format, **save)
    return output.getvalue()


JPEG = picture()
PNG = picture("PNG")
OTHER_JPEG = picture(size=(16, 16))

"""Every upload is rebuilt from its pixels, so nothing else in the file survives."""

import importlib.util
import io
from pathlib import Path

import pytest
from PIL import Image, PngImagePlugin

from services.errors import ImageNotSupported, ImageTooLarge
from services.images import MAX_PHOTO_BYTES, clean_image, image_file_name, image_type
from tests.images import JPEG, PNG, picture

SECRET = "Secret Street 123, shot by Gabi"
_GPS_IFD = 0x8825
_ARTIST = 0x013B
_ORIENTATION = 0x0112


def _exif(orientation: int | None = None) -> Image.Exif:
    exif = Image.Exif()
    exif[_ARTIST] = SECRET
    if orientation:
        exif[_ORIENTATION] = orientation
    exif.get_ifd(_GPS_IFD)[1] = "S"
    return exif


def test_a_jpeg_loses_its_location_author_and_comment():
    dirty = picture(exif=_exif(), comment=SECRET.encode())
    assert SECRET.encode() in dirty
    clean = clean_image(dirty, MAX_PHOTO_BYTES)
    assert SECRET.encode() not in clean.data
    with Image.open(io.BytesIO(clean.data)) as image:
        assert not image.getexif()
        assert "comment" not in image.info


def test_a_png_loses_its_text():
    info = PngImagePlugin.PngInfo()
    info.add_text("Author", SECRET)
    dirty = picture("PNG", pnginfo=info)
    assert SECRET.encode() in dirty
    clean = clean_image(dirty, MAX_PHOTO_BYTES)
    assert SECRET.encode() not in clean.data
    assert clean.content_type == "image/png"


def test_a_webp_loses_its_exif():
    dirty = picture("WEBP", exif=_exif())
    assert SECRET.encode() in dirty
    assert SECRET.encode() not in clean_image(dirty, MAX_PHOTO_BYTES).data


def test_a_colour_profile_goes_too():
    dirty = picture(icc_profile=SECRET.encode() * 4)
    assert SECRET.encode() not in clean_image(dirty, MAX_PHOTO_BYTES).data


def test_anything_hidden_after_the_picture_goes_too():
    assert SECRET.encode() not in clean_image(JPEG + SECRET.encode(), MAX_PHOTO_BYTES).data


def test_a_rotated_photo_stays_the_right_way_up():
    dirty = picture(size=(10, 4), exif=_exif(orientation=6))
    with Image.open(io.BytesIO(clean_image(dirty, MAX_PHOTO_BYTES).data)) as image:
        assert image.size == (4, 10)


def test_transparency_survives_in_a_png():
    output = io.BytesIO()
    Image.new("RGBA", (4, 4), (0, 0, 0, 0)).save(output, format="PNG")
    clean = clean_image(output.getvalue(), MAX_PHOTO_BYTES)
    with Image.open(io.BytesIO(clean.data)) as image:
        assert image.mode == "RGBA"


@pytest.mark.parametrize("data", [b"", b"not a picture", b"\xff\xd8\xff\xe0broken", b"GIF89a"])
def test_what_isnt_a_readable_picture_is_refused(data):
    with pytest.raises(ImageNotSupported):
        clean_image(data, MAX_PHOTO_BYTES)


def test_too_many_bytes_are_refused_before_opening_anything():
    with pytest.raises(ImageTooLarge):
        clean_image(JPEG, 10)


def test_a_small_file_that_unpacks_into_a_huge_picture_is_refused():
    bomb = picture("PNG", size=(8000, 8000))
    assert len(bomb) < MAX_PHOTO_BYTES
    with pytest.raises(ImageNotSupported):
        clean_image(bomb, MAX_PHOTO_BYTES)


def test_the_type_comes_from_the_bytes():
    assert image_type(PNG) == "image/png"
    assert clean_image(PNG, MAX_PHOTO_BYTES).content_type == "image/png"


def test_every_file_gets_the_same_kind_of_name_saying_nothing():
    name = image_file_name(JPEG, "image/jpeg")
    assert name.startswith("gymbros-") and name.endswith(".jpg")
    assert name == image_file_name(JPEG, "image/jpeg")
    assert name != image_file_name(PNG, "image/jpeg")


def test_the_migration_cleans_images_stored_before_this():
    path = Path(__file__).parents[1] / "migrations/versions"
    file = next(path.glob("*add_emoji_reactions_and_comment_photos.py"))
    spec = importlib.util.spec_from_file_location("clean_stored_images", file)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    dirty = picture(exif=_exif(), comment=SECRET.encode())
    cleaned = migration._without_metadata(dirty)  # pylint: disable=protected-access
    assert SECRET.encode() not in cleaned
    assert cleaned.startswith(b"\xff\xd8\xff")
    assert migration._without_metadata(b"not a picture") is None  # pylint: disable=protected-access

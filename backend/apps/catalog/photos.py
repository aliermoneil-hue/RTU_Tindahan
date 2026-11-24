"""What a stored photo is allowed to be (SE-04 and SE-06, by another route).

Two things are true of any photo a member uploads, and neither is caught by
checking the extension:

* a phone photo carries EXIF, and EXIF carries the coordinates where it was
  taken. Publishing that with a listing tells a stranger where the seller
  sleeps.
* a file can be a valid JPEG *and* a valid HTML document — a "polyglot" — which
  a browser served from our own origin may execute if it sniffs the type.

Decoding the pixels and writing a fresh JPEG throws both away. What is stored is
what the camera saw, and nothing else the file was carrying.
"""

import io
import uuid

from django.core.files.base import ContentFile


def clean_photo(image) -> ContentFile:
    """Re-encode an uploaded photo as a fresh JPEG with no metadata."""
    from PIL import Image

    image.seek(0)
    with Image.open(image) as probe:
        probe.load()
        frame = probe.convert("RGB")
    buffer = io.BytesIO()
    frame.save(buffer, format="JPEG", quality=88, optimize=True)
    image.seek(0)
    return ContentFile(buffer.getvalue(), name=f"{uuid.uuid4().hex}.jpg")

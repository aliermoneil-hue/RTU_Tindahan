"""One extra key on every error, so the client can tell two 401s apart.

DRF answers an `AuthenticationFailed` with `{"detail": "…"}` and throws the
machine-readable code away. Two failures matter to the browser and are both
401s: a session that ended because it was idle (SE-05) and one that ended
because the token aged out. The screen has to say the right sentence, and the
app has to clear a token that will never work again — neither is possible from
prose.

This handler adds `code` beside `detail` when the exception carried one, and
changes nothing else: the status, the detail text and every existing body stay
exactly as they were, so no client breaks.
"""

from rest_framework.views import exception_handler as drf_exception_handler


def code_enriched_exception_handler(exc, context):
    response = drf_exception_handler(exc, context)
    if response is None:
        return None

    if isinstance(response.data, dict) and "code" not in response.data:
        codes = exc.get_codes() if hasattr(exc, "get_codes") else None
        if isinstance(codes, str):
            response.data["code"] = codes

    return response

"""RTU identity rules.

AV-01/AV-02: only official RTU email addresses may register.
Appendix B of the SRS still marks the exact format as "to confirm", so the
domain and the student-number pattern are read from settings and can be
changed in .env without editing code.
"""

import re

from django.conf import settings
from django.core.exceptions import ValidationError


def normalize_email(email: str) -> str:
    return (email or "").strip().lower()


def validate_rtu_email(email: str, member_type: str | None = None) -> str:
    """Return the normalised email or raise ValidationError.

    Every account needs an @rtu.edu.ph address. Students additionally need the
    student-number form, 0000-000000@rtu.edu.ph (AV-04).
    """
    email = normalize_email(email)
    domain = settings.RTU_EMAIL_DOMAIN.lower().lstrip("@")

    if not email.endswith(f"@{domain}"):
        raise ValidationError(
            f"Use your official RTU email address (…@{domain}).",
            code="invalid_rtu_domain",
        )

    if member_type == "student":
        pattern = settings.RTU_STUDENT_EMAIL_REGEX
        if not re.match(pattern, email):
            raise ValidationError(
                "Student accounts use the student number form, "
                "0000-000000@rtu.edu.ph.",
                code="invalid_student_email",
            )

    return email


def student_number_from_email(email: str) -> str | None:
    """Extract 0000-000000 from a student email, if it has that form."""
    match = re.match(settings.RTU_STUDENT_EMAIL_REGEX, normalize_email(email))
    return match.group("student_number") if match else None

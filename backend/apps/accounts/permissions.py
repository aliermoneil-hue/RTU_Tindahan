"""DRF permission classes for the five SRS user classes.

These run on the server. The React app may hide a button, but the rule is
enforced here (SRS 3.2.10 and the prototype's known-limits note).
"""

from rest_framework.permissions import BasePermission

from .models import User


class IsActiveAccount(BasePermission):
    message = "This account is suspended or banned."

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.can_sign_in)


class IsVerifiedUser(IsActiveAccount):
    """BR-01: only verified RTU members may buy, sell, message, or post."""

    message = "Verify your RTU email address before using this feature."

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and user.can_sign_in
            and user.is_verified
            and user.role != User.Role.VISITOR
        )


class IsOfficeStaff(IsVerifiedUser):
    """ST-01 and BR-04: only Office Staff manage official items/announcements."""

    message = "Only Office Staff may perform this action."

    def has_permission(self, request, view):
        return super().has_permission(request, view) and request.user.is_office_staff


class IsModerator(IsVerifiedUser):
    """RM-03: moderators review flagged content, reports, and appeals."""

    message = "Only a moderator may perform this action."

    def has_permission(self, request, view):
        return super().has_permission(request, view) and request.user.is_moderator


class IsAdministrator(IsActiveAccount):
    """AD-01 to AD-05: account, role, category, and audit management."""

    message = "Only an administrator may perform this action."

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and user.can_sign_in
            and (user.role == User.Role.ADMINISTRATOR or user.is_superuser)
        )

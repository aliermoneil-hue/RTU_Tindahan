"""Favorites API.

    GET    /api/v1/favorites/          the caller's saved listings and sellers
    POST   /api/v1/favorites/toggle/   save or remove one target
    DELETE /api/v1/favorites/<id>/     remove a saved row by id

The list is private by construction: the queryset is filtered to the caller, so
there is no id a member can guess to read somebody else's list.
"""

from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.permissions import IsVerifiedUser

from .models import Favorite
from .serializers import FavoriteSerializer, FavoriteToggleSerializer


class FavoriteViewSet(
    mixins.ListModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = FavoriteSerializer
    permission_classes = [IsVerifiedUser]
    # A member's list is short; paging it would only add a wrapper the frontend
    # has to unwrap.
    pagination_class = None

    def get_queryset(self):
        return Favorite.objects.filter(user=self.request.user).select_related(
            "listing", "seller"
        )

    @action(detail=False, methods=["post"])
    def toggle(self, request):
        payload = FavoriteToggleSerializer(data=request.data, context={"request": request})
        payload.is_valid(raise_exception=True)
        listing = payload.validated_data.get("listing")
        seller = payload.validated_data.get("seller")

        lookup = {"user": request.user}
        if listing is not None:
            lookup["listing"] = listing
        else:
            lookup["seller"] = seller

        existing = Favorite.objects.filter(**lookup).first()
        if existing is not None:
            existing.delete()
            return Response({"saved": False})

        favorite = Favorite.objects.create(**lookup)
        return Response(
            {"saved": True, "favorite": FavoriteSerializer(favorite).data},
            status=status.HTTP_201_CREATED,
        )

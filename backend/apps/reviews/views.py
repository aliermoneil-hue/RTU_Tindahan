"""Ratings API.

    GET    /api/v1/reviews/            public: ?listing=<id> ?seller=<email>
                                       ?order=<reference> ?mine=1
    POST   /api/v1/reviews/            the buyer of a completed order
    DELETE /api/v1/reviews/<id>/       the buyer, or a moderator

POST is create-or-update: a member editing a rating keeps one row, so a
double submit or an edit never turns into two reviews.
"""

from django.db import transaction
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from apps.accounts.permissions import IsVerifiedUser
from apps.notifications.services import notify

from .models import Review
from .serializers import ReviewSerializer, ReviewWriteSerializer


class ReviewViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = ReviewSerializer

    def get_permissions(self):
        if self.action == "list":
            return [AllowAny()]
        if self.action == "create":
            return [IsVerifiedUser()]
        return [IsAuthenticated()]

    def get_queryset(self):
        queryset = Review.objects.select_related("order", "buyer", "seller", "listing")
        params = self.request.query_params
        user = self.request.user

        if params.get("mine") in {"1", "true", "yes"}:
            if not (user and user.is_authenticated):
                return queryset.none()
            queryset = queryset.filter(buyer=user)
        if params.get("listing"):
            queryset = queryset.filter(listing_id=params["listing"])
        if params.get("listing_slug"):
            queryset = queryset.filter(listing__slug=params["listing_slug"])
        if params.get("seller"):
            queryset = queryset.filter(seller__email=params["seller"])
        if params.get("order"):
            queryset = queryset.filter(order__reference=params["order"])
        return queryset

    def create(self, request, *args, **kwargs):
        payload = ReviewWriteSerializer(data=request.data, context={"request": request})
        payload.is_valid(raise_exception=True)
        order = payload.validated_data["order"]
        listing = payload.validated_data.get("listing")

        with transaction.atomic():
            review = Review.objects.select_for_update().filter(order=order, listing=listing).first()
            if review is None:
                review = Review.objects.create(
                    order=order,
                    listing=listing,
                    buyer=request.user,
                    seller=order.seller,
                    stars=payload.validated_data["stars"],
                    text=payload.validated_data.get("text", "").strip(),
                )
                created = True
            else:
                review.buyer = request.user
                review.seller = order.seller
                review.stars = payload.validated_data["stars"]
                review.text = payload.validated_data.get("text", "").strip()
                review.edited_at = timezone.now()
                review.save(
                    update_fields=["buyer", "seller", "stars", "text", "edited_at", "updated_at"]
                )
                created = False
        if created:
            notify(
                review.seller,
                f"{review.buyer.display_name} rated you {review.stars} of 5 stars for order {order.reference}.",
                kind="review",
                link_kind="reviews",
                actor=review.buyer,
            )
        return Response(
            ReviewSerializer(review, context=self.get_serializer_context()).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    def perform_destroy(self, instance):
        user = self.request.user
        if instance.buyer_id != user.id and not user.is_moderator:
            raise PermissionDenied("You can only delete your own review.")
        instance.delete()

"""Forum API.

    GET    /api/v1/forum/posts/                 public feed (hidden rows excluded)
    POST   /api/v1/forum/posts/                  verified members
    GET    /api/v1/forum/posts/<id>/             public
    PATCH  /api/v1/forum/posts/<id>/             the author
    DELETE /api/v1/forum/posts/<id>/             the author or a moderator
    POST   /api/v1/forum/posts/<id>/comments/    verified members
    POST   /api/v1/forum/posts/<id>/react/       verified members
    POST   /api/v1/forum/posts/<id>/moderate/    moderators (hide/restore/pin/delete)
    PATCH  /api/v1/forum/comments/<id>/          the author
    DELETE /api/v1/forum/comments/<id>/          the author or a moderator
    POST   /api/v1/forum/reports/                verified members
    GET    /api/v1/forum/reports/                staff see all; a member sees their own
    POST   /api/v1/forum/reports/<id>/resolve/    moderators

Moderation decisions are reversible where the data allows it: hide/restore flip
a timestamp rather than deleting, and a comment with replies is soft-deleted so
the thread below it survives.
"""

from django.db.models import Q
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from apps.accounts.permissions import IsVerifiedUser
from apps.audit.services import record
from apps.notifications.services import notify, notify_staff
from apps.screening.services import run_comment_screening, run_post_screening

from .models import ForumComment, ForumPost, ForumReaction, ForumReport
from .serializers import (
    ForumCommentSerializer,
    ForumCommentWriteSerializer,
    ForumModerateSerializer,
    ForumPostSerializer,
    ForumPostWriteSerializer,
    ForumReactSerializer,
    ForumReportResolveSerializer,
    ForumReportSerializer,
    ForumReportWriteSerializer,
    save_images,
)


def is_staff(user):
    return bool(user and user.is_authenticated and user.is_moderator)


def hide_post(post, by):
    post.hidden_by = by
    post.hidden_at = timezone.now()
    post.save(update_fields=["hidden_by", "hidden_at"])


def restore_post(post):
    post.hidden_by = None
    post.hidden_at = None
    post.save(update_fields=["hidden_by", "hidden_at"])


def hide_comment(comment, by):
    comment.hidden_by = by
    comment.hidden_at = timezone.now()
    comment.save(update_fields=["hidden_by", "hidden_at"])


def restore_comment(comment):
    comment.hidden_by = None
    comment.hidden_at = None
    comment.save(update_fields=["hidden_by", "hidden_at"])


def delete_comment(comment):
    """Keep a comment that has replies as a tombstone, remove a leaf."""
    if comment.replies.exists():
        comment.deleted_at = timezone.now()
        comment.text = ""
        comment.hidden_by = None
        comment.hidden_at = None
        comment.save(update_fields=["deleted_at", "text", "hidden_by", "hidden_at"])
    else:
        comment.delete()


class ForumPostViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    def get_permissions(self):
        if self.action in {"list", "retrieve"}:
            return [AllowAny()]
        return [IsVerifiedUser()]

    def get_queryset(self):
        queryset = (
            ForumPost.objects.select_related("author", "hidden_by")
            .prefetch_related(
                "comments__author",
                "comments__hidden_by",
                "comments__screening_results",
                "reactions",
                "screening_results",
            )
        )
        user = self.request.user
        params = self.request.query_params

        # A hidden post is gone from the public feed, but its author can still
        # open it to see why, and staff need it for the report queue. A post
        # held by screening is the same: out of the feed, readable by the
        # author (so it is not a silent disappearance) and by staff.
        public = Q(
            hidden_at__isnull=True,
            moderation_status=ForumPost.ModerationStatus.VISIBLE,
        )
        if not is_staff(user):
            if user and user.is_authenticated:
                queryset = queryset.filter(public | Q(author=user))
            else:
                queryset = queryset.filter(public)

        if params.get("topic"):
            queryset = queryset.filter(topic=params["topic"])
        if params.get("kind"):
            queryset = queryset.filter(kind=params["kind"])
        if params.get("author") == "me" and user and user.is_authenticated:
            queryset = queryset.filter(author=user)
        if raw := params.get("moderation"):
            asked = [value.strip().lower() for value in raw.split(",") if value.strip()]
            valid = {value for value, _ in ForumPost.ModerationStatus.choices}
            unknown = [value for value in asked if value not in valid]
            if unknown:
                raise ValidationError(
                    {
                        "moderation": f"Unknown moderation status: {', '.join(unknown)}. "
                        f"Valid values: {', '.join(sorted(valid))}."
                    }
                )
            queryset = queryset.filter(moderation_status__in=asked)
        return queryset

    def get_serializer_class(self):
        if self.action in {"create", "update", "partial_update"}:
            return ForumPostWriteSerializer
        return ForumPostSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        kind = data.get("kind") or ForumPost.Kind.POST
        if kind == ForumPost.Kind.NOTICE and not is_staff(request.user):
            raise PermissionDenied("Only RTU staff may post a notice.")

        post = ForumPost.objects.create(
            kind=kind,
            topic=data.get("topic") or "",
            title=data.get("title", ""),
            body=data.get("body", ""),
            author=request.user,
            images=save_images(data.get("images"), request),
            # CF-05: kept on every topic (blank elsewhere) so a Selling schedule
            # post is an appointment the server validated, not prose.
            event_date=data.get("event_date"),
            event_start=data.get("event_start"),
            event_end=data.get("event_end"),
            event_place=data.get("event_place", ""),
        )
        # Screen before anyone is told about it: a notice that screening holds
        # must not fan out to the whole campus first.
        result = run_post_screening(post)
        if kind == ForumPost.Kind.NOTICE and not result.is_flagged:
            # A notice is an announcement: every verified member hears it once.
            from apps.accounts.models import User

            members = User.objects.filter(
                role=User.Role.USER,
                is_active=True,
                status=User.Status.ACTIVE,
                verified_at__isnull=False,
            ).exclude(pk=request.user.pk)
            for member in members:
                notify(
                    member,
                    f"New announcement: {post.title or post.body[:60]}",
                    kind="announcement",
                    link_kind="post",
                    link_id=post.pk,
                    actor=request.user,
                )
        return Response(
            ForumPostSerializer(post, context=self.get_serializer_context()).data,
            status=status.HTTP_201_CREATED,
        )

    def update(self, request, *args, **kwargs):
        post = self.get_object()
        if post.author_id != request.user.id:
            raise PermissionDenied("You can only edit your own posts.")
        if post.is_hidden:
            raise PermissionDenied("Staff hid this post, so it cannot be edited.")
        serializer = self.get_serializer(post, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        for field in ("title", "body", "topic", "event_date", "event_start", "event_end", "event_place"):
            if field in data:
                setattr(post, field, data[field])
        if "images" in data:
            post.images = save_images(data["images"], request)
        post.edited_at = timezone.now()
        post.save()
        if any(field in data for field in ("title", "body", "topic")):
            # An edit changes the words a moderator judged: re-screen it. A
            # flagged edit holds the post again; a clean edit leaves the
            # status alone, because releasing is a moderator's decision.
            run_post_screening(post)
        return Response(ForumPostSerializer(post, context=self.get_serializer_context()).data)

    def destroy(self, request, *args, **kwargs):
        post = self.get_object()
        if post.author_id != request.user.id and not is_staff(request.user):
            raise PermissionDenied("You can only delete your own posts.")
        if is_staff(request.user) and post.author_id != request.user.id:
            record(
                request.user,
                "delete forum post",
                target_type="forum post",
                target_id=post.pk,
                target_name=post.title or post.body[:60],
            )
            ForumReport.objects.filter(
                status=ForumReport.Status.OPEN, post=post, comment__isnull=True
            ).update(
                status=ForumReport.Status.ACTIONED,
                action="delete",
                handled_by=request.user,
                handled_at=timezone.now(),
            )
        post.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"])
    def comments(self, request, pk=None):
        post = self.get_object()
        if post.is_hidden and not is_staff(request.user):
            raise PermissionDenied("This post is hidden.")
        payload = ForumCommentWriteSerializer(data=request.data)
        payload.is_valid(raise_exception=True)

        parent = None
        parent_id = payload.validated_data.get("parent")
        if parent_id is not None:
            parent = ForumComment.objects.filter(pk=parent_id, post=post).first()
            if parent is None or parent.is_deleted or parent.is_hidden:
                raise PermissionDenied("That comment is no longer available.")

        comment = ForumComment.objects.create(
            post=post,
            author=request.user,
            text=payload.validated_data["text"],
            parent=parent,
        )
        # Screen before anyone else can read it: a flagged comment is held out
        # of the thread instead of publishing inside someone's post.
        run_comment_screening(comment)
        if post.author_id and post.author_id != request.user.id:
            notify(
                post.author,
                f"{request.user.display_name} commented on your forum post.",
                kind="comment",
                link_kind="post",
                link_id=post.pk,
                actor=request.user,
            )
        if (
            parent is not None
            and parent.author_id
            and parent.author_id not in {request.user.id, post.author_id}
        ):
            notify(
                parent.author,
                f"{request.user.display_name} replied to your comment.",
                kind="comment",
                link_kind="post",
                link_id=post.pk,
                actor=request.user,
            )
        return Response(
            ForumCommentSerializer(comment, context=self.get_serializer_context()).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"])
    def react(self, request, pk=None):
        post = self.get_object()
        payload = ForumReactSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        key = payload.validated_data["key"]

        existing = ForumReaction.objects.filter(post=post, user=request.user).first()
        if existing is not None and existing.key == key:
            existing.delete()
            mine = None
        elif existing is not None:
            existing.key = key
            existing.save(update_fields=["key"])
            mine = key
        else:
            ForumReaction.objects.create(post=post, user=request.user, key=key)
            mine = key

        counts = {}
        for reaction in ForumReaction.objects.filter(post=post):
            counts[reaction.key] = counts.get(reaction.key, 0) + 1
        return Response({"my_reaction": mine, "react_counts": counts})

    @action(detail=True, methods=["post"])
    def moderate(self, request, pk=None):
        if not is_staff(request.user):
            raise PermissionDenied("Only a moderator may moderate the forum.")
        post = self.get_object()
        payload = ForumModerateSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        act = payload.validated_data["action"]

        target_name = post.title or post.body[:60] or f"Post {post.pk}"
        if act == "hide":
            hide_post(post, request.user)
        elif act == "restore":
            # Restoring means "this is fit to be seen": it puts the post back
            # in the feed and clears a hold that screening left on it.
            restore_post(post)
            post.release_from_review()
        elif act == "pin":
            post.pinned = True
            post.save(update_fields=["pinned"])
        elif act == "unpin":
            post.pinned = False
            post.save(update_fields=["pinned"])
        elif act == "delete":
            post.delete()
            record(
                request.user,
                "delete forum post",
                target_type="forum post",
                target_id=pk,
                target_name=target_name,
            )
            return Response(status=status.HTTP_204_NO_CONTENT)

        record(
            request.user,
            f"{act} forum post",
            target_type="forum post",
            target_id=post.pk,
            target_name=target_name,
        )

        post.refresh_from_db()
        return Response(ForumPostSerializer(post, context=self.get_serializer_context()).data)


class ForumCommentViewSet(
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = ForumCommentSerializer
    permission_classes = [IsVerifiedUser]

    def get_queryset(self):
        return ForumComment.objects.select_related("author", "hidden_by", "post").prefetch_related(
            "screening_results"
        )

    def update(self, request, *args, **kwargs):
        comment = self.get_object()
        if comment.author_id != request.user.id:
            raise PermissionDenied("You can only edit your own comments.")
        if comment.is_deleted or comment.is_hidden:
            raise PermissionDenied("This comment can no longer be edited.")
        payload = ForumCommentWriteSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        comment.text = payload.validated_data["text"]
        comment.edited_at = timezone.now()
        comment.save(update_fields=["text", "edited_at"])
        # An edit changes the words a moderator judged, so screen it again.
        run_comment_screening(comment)
        return Response(ForumCommentSerializer(comment, context=self.get_serializer_context()).data)

    def destroy(self, request, *args, **kwargs):
        comment = self.get_object()
        if comment.author_id != request.user.id and not is_staff(request.user):
            raise PermissionDenied("You can only delete your own comments.")
        delete_comment(comment)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"])
    def moderate(self, request, pk=None):
        if not is_staff(request.user):
            raise PermissionDenied("Only a moderator may moderate the forum.")
        comment = self.get_object()
        payload = ForumModerateSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        act = payload.validated_data["action"]

        target_name = comment.text[:60] or f"Comment {comment.pk}"
        if act == "hide":
            hide_comment(comment, request.user)
        elif act == "restore":
            restore_comment(comment)
            comment.release_from_review()
        elif act == "delete":
            delete_comment(comment)
            record(
                request.user,
                "delete forum comment",
                target_type="forum comment",
                target_id=pk,
                target_name=target_name,
            )
            return Response(status=status.HTTP_204_NO_CONTENT)
        else:
            raise PermissionDenied("That action does not apply to a comment.")

        record(
            request.user,
            f"{act} forum comment",
            target_type="forum comment",
            target_id=comment.pk,
            target_name=target_name,
        )
        comment.refresh_from_db()
        return Response(
            ForumCommentSerializer(comment, context=self.get_serializer_context()).data
        )


class ForumReportViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = ForumReportSerializer
    permission_classes = [IsVerifiedUser]

    def get_queryset(self):
        queryset = ForumReport.objects.select_related(
            "reporter", "post", "post__author", "comment", "comment__author", "order",
            "order__buyer", "order__seller", "listing", "reported_user", "review", "handled_by",
        )
        user = self.request.user
        if not is_staff(user):
            queryset = queryset.filter(reporter=user)
        params = self.request.query_params
        if params.get("status"):
            queryset = queryset.filter(status=params["status"])
        if params.get("type"):
            queryset = queryset.filter(type=params["type"])
        return queryset

    def create(self, request, *args, **kwargs):
        serializer = ForumReportWriteSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        report = ForumReport.objects.create(
            type=data["type"],
            post=data.get("post"),
            comment=data.get("comment"),
            order=data.get("order"),
            listing=data.get("listing"),
            reported_user=data.get("reported_user"),
            review=data.get("review"),
            reporter=request.user,
            reason=data["reason"].strip(),
            details=(data.get("details") or "").strip(),
            snapshot_title=data.get("snapshot_title", ""),
            snapshot_text=data.get("snapshot_text", ""),
        )
        notify_staff(
            f"A {report.type} was reported: {report.reason}.",
            link_kind="freports",
            actor=request.user,
        )
        return Response(
            ForumReportSerializer(report, context=self.get_serializer_context()).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"])
    def resolve(self, request, pk=None):
        if not is_staff(request.user):
            raise PermissionDenied("Only a moderator may handle reports.")
        report = self.get_object()
        payload = ForumReportResolveSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        data = payload.validated_data
        new_status = data["status"]
        act = data.get("action") or ""

        if new_status == ForumReport.Status.OPEN:
            report.status = new_status
            report.handled_by = None
            report.handled_at = None
            report.action = ""
            report.note = ""
            report.save(update_fields=["status", "handled_by", "handled_at", "action", "note"])
            return Response(ForumReportSerializer(report, context=self.get_serializer_context()).data)

        if report.type != ForumReport.Type.ORDER and act:
            if act == "hide":
                if report.comment_id:
                    hide_comment(report.comment, request.user)
                elif report.post_id:
                    hide_post(report.post, request.user)
            elif act == "restore":
                if report.comment_id:
                    restore_comment(report.comment)
                elif report.post_id:
                    restore_post(report.post)
            elif act == "delete":
                if report.comment_id:
                    delete_comment(report.comment)
                elif report.post_id:
                    report.post.delete()

        report.status = new_status
        report.handled_by = request.user
        report.handled_at = timezone.now()
        report.action = act
        report.note = (data.get("note") or "").strip()
        report.save(
            update_fields=["status", "handled_by", "handled_at", "action", "note"]
        )
        record(
            request.user,
            "resolve forum report",
            target_type="forum report",
            target_id=report.pk,
            target_name=report.reason,
            note=f"{report.status}" + (f" / {act}" if act else ""),
        )
        if report.reporter_id != request.user.id:
            outcome = {
                ForumReport.Status.DISMISSED: "Staff reviewed your report and did not find a problem.",
                ForumReport.Status.ACTIONED: "Staff reviewed your report and took action.",
                ForumReport.Status.REVIEWED: "Staff reviewed your report. Thank you.",
            }.get(report.status, "Staff reviewed your report.")
            notify(report.reporter, outcome, kind="report", actor=request.user)
        return Response(ForumReportSerializer(report, context=self.get_serializer_context()).data)

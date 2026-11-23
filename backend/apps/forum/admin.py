from django.contrib import admin

from .models import ForumComment, ForumPost, ForumReaction, ForumReport


class ForumCommentInline(admin.TabularInline):
    model = ForumComment
    extra = 0
    raw_id_fields = ("author", "parent")


@admin.register(ForumPost)
class ForumPostAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "kind", "topic", "author", "pinned", "hidden_at", "created_at")
    list_filter = ("kind", "pinned", "hidden_at", "topic")
    search_fields = ("title", "body", "author__email")
    raw_id_fields = ("author", "hidden_by")
    inlines = [ForumCommentInline]


@admin.register(ForumReport)
class ForumReportAdmin(admin.ModelAdmin):
    list_display = ("id", "type", "status", "reason", "reporter", "created_at")
    list_filter = ("type", "status")
    search_fields = ("reason", "details", "reporter__email")
    raw_id_fields = ("post", "comment", "order", "reporter", "handled_by")


@admin.register(ForumReaction)
class ForumReactionAdmin(admin.ModelAdmin):
    list_display = ("post", "user", "key", "created_at")
    raw_id_fields = ("post", "user")

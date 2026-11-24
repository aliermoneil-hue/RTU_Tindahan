"""Give a freshly emptied install enough population to be measured.

    manage.py seed_stress_data                      # 20 sellers, 40 listings
    manage.py seed_stress_data --sellers 50 --listings 4 --posts 60
    manage.py seed_stress_data --clear              # take it out again

A stress test against an empty database measures empty pages: the queries are the
same but the rows, joins and serialisation are not, so the numbers flatter the
server. This creates a plausible marketplace instead — verified students, approved
listings spread across the real categories, and forum threads — and a staff
moderator so the moderation queue can be loaded too.

Accounts are only created if missing, so running it twice does not double the
population. Nothing here bypasses a rule: listings are written through the ORM with
their moderation status set, because the point is a loaded read path, not to
re-prove the screener that already has its own tests.
"""

import random

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.catalog.models import Category, Listing, ListingVariant
from apps.forum.models import ForumPost

PASSWORD = "StressTest!2345"

FIRST = ["Mika", "Lian", "Rafael", "Bea", "Jomar", "Trisha", "Neil", "Ana", "Kier", "Joy"]
LAST = ["Santos", "Dela Cruz", "Reyes", "Bautista", "Ocampo", "Villar", "Cruz", "Lim"]

TITLES = [
    "Scientific calculator, slightly used",
    "Pre-loved Rizal textbook",
    "PE uniform, size M",
    "Ballpen set of five",
    "Soldering iron with stand",
    "Second-hand drafting board",
    "Iced coffee voucher",
    "Notebook bundle, unused pages",
    "USB-C cable, 1 metre",
    "Calculus reviewer with answers",
    "Extension cord, 3 sockets",
    "Lab goggles, clean",
    "ID lace with RTU print",
    "Baking tray, non-stick",
    "Arduino starter kit",
    "Merienda pack for two",
]

BODIES = [
    "Selling because I upgraded. No defects, meet at the covered court.",
    "Used for one semester only. Still complete and clean.",
    "Clearing out my locker before the break. Pick up near the CICT lobby.",
    "Bought last month, changed my mind. Receipt included.",
    "Spare unit, kept in a case since I got it.",
]


class Command(BaseCommand):
    help = "Populate a test install with sellers, listings and forum posts."

    def add_arguments(self, parser):
        parser.add_argument("--sellers", type=int, default=20)
        parser.add_argument("--listings", type=int, default=2, help="per seller")
        parser.add_argument("--posts", type=int, default=30)
        parser.add_argument("--staff", type=int, default=1)
        parser.add_argument(
            "--clear", action="store_true", help="remove what this command created"
        )

    def handle(self, *args, **options):
        User = get_user_model()
        stamp = User.objects.filter(email__startswith="stress").aggregate(
            **{"n": __import__("django.db.models", fromlist=["Count"]).Count("id")}
        )["n"]

        if options["clear"]:
            users = User.objects.filter(email__startswith="stress")
            listings = Listing.objects.filter(seller__in=users)
            posts = ForumPost.objects.filter(author__in=users)
            self.stdout.write(
                f"removing {listings.count()} listing(s), {posts.count()} post(s), "
                f"{users.count()} account(s)"
            )
            listings.delete()
            posts.delete()
            users.delete()
            return

        category = Category.objects.get(slug="school-supplies") if Category.objects.filter(
            slug="school-supplies"
        ).exists() else Category.objects.first()
        if category is None:
            self.stderr.write(self.style.ERROR("No categories exist; seed them first."))
            return

        college = None
        try:
            from apps.accounts.models import College

            college = College.objects.first()
        except Exception:
            pass

        now = timezone.now()
        created_users = created_listings = created_posts = 0

        with transaction.atomic():
            for index in range(options["sellers"]):
                email = f"stress-seller-{index:03d}@rtu.edu.ph"
                if User.objects.filter(email=email).exists():
                    continue
                user = User.objects.create_user(
                    email=email,
                    display_name=f"{random.choice(FIRST)} {random.choice(LAST)}",
                    password=PASSWORD,
                )
                user.member_type = User.MemberType.STUDENT
                user.college = college
                user.year_level = random.randint(1, 4)
                # BR-01: a verified member is not merely stamped with a date; the
                # role moves from visitor to user as well, which is what the API's
                # permission classes actually read.
                user.status = User.Status.ACTIVE
                user.is_active = True
                user.role = User.Role.USER
                user.verified_at = now
                user.save()
                created_users += 1

                for n in range(options["listings"]):
                    title = random.choice(TITLES)
                    listing = Listing.objects.create(
                        seller=user,
                        category=category,
                        title=f"{title} #{index}{n}",
                        description=random.choice(BODIES),
                        price=random.randrange(20, 900),
                        quantity=random.randint(1, 5),
                        condition=Listing.Condition.USED,
                        meetup_place="Covered court",
                        moderation_status=Listing.ModerationStatus.APPROVED,
                        published_at=now,
                    )
                    created_listings += 1

            staff_email = "stress-moderator@rtu.edu.ph"
            if options["staff"] and not User.objects.filter(email=staff_email).exists():
                moderator = User.objects.create_user(
                    email=staff_email, display_name="Stress Moderator", password=PASSWORD
                )
                moderator.role = "moderator"
                moderator.is_staff = True
                moderator.member_type = User.MemberType.STUDENT
                moderator.college = college
                moderator.status = User.Status.ACTIVE
                moderator.is_active = True
                moderator.verified_at = now
                moderator.save()
                created_users += 1

            sellers = list(User.objects.filter(email__startswith="stress-seller-"))
            for index in range(options["posts"]):
                if not sellers:
                    break
                ForumPost.objects.create(
                    author=sellers[index % len(sellers)],
                    kind="post",
                    topic=random.choice(["General", "Buying", "Selling schedule"]),
                    title=f"Stress thread {index}",
                    body=random.choice(BODIES),
                    moderation_status=ForumPost.ModerationStatus.VISIBLE
                    if hasattr(ForumPost, "ModerationStatus")
                    else "visible",
                )
                created_posts += 1

        total_users = User.objects.filter(email__startswith="stress").count()
        total_listings = Listing.objects.count()
        self.stdout.write(
            f"\ncreated {created_users} account(s), {created_listings} listing(s), "
            f"{created_posts} post(s)"
        )
        self.stdout.write(
            f"now: {total_users} stress account(s), {total_listings} listing(s) in total, "
            f"{Category.objects.count()} categories"
        )
        self.stdout.write(
            self.style.WARNING(
                f"\nAll stress accounts use the password: {PASSWORD}\n"
                f"Moderator: stress-moderator@rtu.edu.ph\n"
                "Remove them with: manage.py seed_stress_data --clear"
            )
        )

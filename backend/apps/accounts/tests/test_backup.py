"""Nightly database copies: written, read back, pruned (docs/BACKUP.md)."""

import os
import shutil
import sqlite3
import tempfile
from io import StringIO
from unittest.mock import patch

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase, override_settings

from apps.accounts.models import User
from apps.catalog.models import Category, Listing


class BackupCommandTests(TestCase):
    def setUp(self):
        self.directory = tempfile.mkdtemp(prefix="tindahan-backup-")
        self.addCleanup(shutil.rmtree, self.directory, True)
        override = override_settings(BACKUP_DIR=self.directory, BACKUP_KEEP=14)
        override.enable()
        self.addCleanup(override.disable)

    def run_command(self, *args):
        out = StringIO()
        call_command("backup_database", *args, stdout=out)
        return out.getvalue()

    def copies(self):
        names = [
            name
            for name in os.listdir(self.directory)
            if name.startswith("db-") and name.endswith(".sqlite3")
        ]
        return sorted(names)

    def test_it_writes_a_verified_copy_with_the_live_rows(self):
        seller = User.objects.create_user(
            email="2024-900001@rtu.edu.ph",
            display_name="Seller",
            password="SecurePass123!",
            member_type=User.MemberType.STUDENT,
            college="College of ICT",
            year_level=2,
        )
        seller.verify()
        Listing.objects.create(
            seller=seller,
            category=Category.objects.create(name="Misc"),
            title="Reviewer",
            description="Notes for ITP311.",
            listing_type=Listing.Type.PRODUCT,
            condition=Listing.Condition.USED,
            price="100.00",
            quantity=1,
            meetup_place="Main gate",
        )

        output = self.run_command()

        names = self.copies()
        self.assertEqual(len(names), 1, output)
        path = os.path.join(self.directory, names[0])
        self.assertEqual(os.stat(path).st_mode & 0o777, 0o600)
        self.assertIn("verified", output.lower())

        probe = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
        try:
            self.assertEqual(
                probe.execute("PRAGMA integrity_check").fetchone()[0], "ok"
            )
            self.assertEqual(
                probe.execute("SELECT COUNT(*) FROM accounts_user").fetchone()[0],
                User.objects.count(),
            )
            self.assertEqual(
                probe.execute("SELECT COUNT(*) FROM catalog_listing").fetchone()[0], 1
            )
        finally:
            probe.close()

    def test_a_dry_run_writes_nothing(self):
        output = self.run_command("--dry-run")

        self.assertEqual(self.copies(), [])
        self.assertIn("would write", output.lower())

    def test_old_copies_are_pruned_and_other_files_are_left_alone(self):
        for index in range(3):
            path = os.path.join(self.directory, f"db-2020010{index + 1}-000000.sqlite3")
            with open(path, "wb") as handle:
                handle.write(b"old")
            os.utime(path, (1_000_000 + index, 1_000_000 + index))
        keep_me = os.path.join(self.directory, "notes.txt")
        with open(keep_me, "w") as handle:
            handle.write("not a backup")

        self.run_command("--keep", "2")

        self.assertEqual(len(self.copies()), 2)
        self.assertTrue(os.path.exists(keep_me))

    def test_a_failed_copy_is_discarded_and_reports_why(self):
        with patch(
            "apps.accounts.management.commands.backup_database.take_snapshot",
            side_effect=OSError("disk full"),
        ):
            with self.assertRaises(CommandError) as caught:
                self.run_command()

        self.assertIn("discarded", str(caught.exception))
        self.assertEqual(self.copies(), [])
        self.assertEqual(
            [name for name in os.listdir(self.directory) if name.endswith(".partial")], []
        )

    def test_it_refuses_to_pretend_on_postgresql(self):
        with patch(
            "apps.accounts.management.commands.backup_database.is_sqlite",
            return_value=False,
        ):
            with self.assertRaises(CommandError) as caught:
                self.run_command()

        self.assertIn("pg_dump", str(caught.exception))

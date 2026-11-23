# PostgreSQL

The approved stack is PostgreSQL; the demo deployment runs SQLite because the
server that serves the tunnel is a small home box and a file is one less service
to keep alive. This file records the proof that the code does not depend on that
choice, and how to run the suite against PostgreSQL yourself.

---

## 1. The switch

`backend/config/settings.py` picks the backend from one variable:

    POSTGRES_DB=rtu_tindahan      # presence of this is the switch
    POSTGRES_USER=rtu_tindahan
    POSTGRES_PASSWORD=...
    POSTGRES_HOST=localhost
    POSTGRES_PORT=5432

With `POSTGRES_DB` set, Django uses `django.db.backends.postgresql`; unset, it
falls back to `backend/db.sqlite3`. The driver is already in
`requirements.txt` (`psycopg[binary]==3.3.6`).

No code reads the vendor except the staff backup endpoint, which streams a copy
made by SQLite's own backup API and therefore answers `501` on PostgreSQL with a
pointer to `pg_dump`. That is deliberate: a JSON export pretending to be a
database backup is worse than an honest refusal.

---

## 2. What was verified

Run on 2026-11-23 against **PostgreSQL 16.2**, started in user space (no root,
no Docker) with the `pgserver` package's bundled binaries:

    migrate --noinput        all migrations applied, no changes needed
    manage.py test           297 tests: 296 passed, 1 skipped (the SQLite-only
                             backup test), 0 failures

Nothing in the application needed a PostgreSQL-specific change. The only fix
was in the test suite: the backup test now skips when the database is not
SQLite, and a second test patches the vendor to prove the `501` path.

Points that usually break on a database switch, and did not:

- case-insensitive email and search lookups (`iexact`, `icontains`);
- the `rating_avg` / `seller_active_listings` annotations (aggregate + subquery);
- partial unique constraints on reviews (one item review per order/listing);
- `JSONField` rows for screening results;
- `select_for_update()` in the stock ledger, which is real on PostgreSQL rather
  than a no-op.

---

## 3. Running it yourself, without root

`pgserver` ships a PostgreSQL build inside a Python wheel. Python 3.14 has no
wheel yet, so use 3.11:

    python3.11 -m venv /tmp/pgenv
    /tmp/pgenv/bin/pip install pgserver

    /tmp/pgenv/bin/python - <<'PY'
    import pgserver
    db = pgserver.get_server("/tmp/pgdata")
    print(db.get_uri())          # starts the server, prints its socket URI
    db.psql("create database rtu_tindahan_pg;")
    PY

`get_server` stops the server when the process exits. To keep it up for a test
run, start the bundled `postgres` binary yourself:

    PG=/tmp/pgenv/lib/python3.11/site-packages/pgserver/pginstall/bin/postgres
    $PG -D /tmp/pgdata -k /tmp/pgdata -h "" &

Then point Django at the socket directory:

    cd backend
    env POSTGRES_DB=rtu_tindahan_pg POSTGRES_USER=postgres POSTGRES_PASSWORD= \
        POSTGRES_HOST=/tmp/pgdata \
        .venv/bin/python manage.py test

A managed server is simpler and is what production should use:

    createdb rtu_tindahan
    createdb -T template0 rtu_tindahan_test    # or let the suite create it
    POSTGRES_DB=rtu_tindahan POSTGRES_USER=... POSTGRES_PASSWORD=... \
      python manage.py migrate

The test runner creates `test_<name>` itself and needs `CREATEDB`; grant it
rather than running the app as a superuser:

    ALTER ROLE rtu_tindahan CREATEDB;

---

## 4. Moving the deployment

SQLite is fine for the capstone demo but it serialises writes and lives on one
disk. To move:

1. create the database and role on the PostgreSQL host;
2. set the five `POSTGRES_*` variables in `backend/.env`;
3. `manage.py migrate` (an empty database needs no data migration);
4. copy rows with `manage.py dumpdata --natural-foreign --natural-primary` from
   the SQLite deployment and `loaddata` into PostgreSQL, or re-seed the demo
   data, which is what the team actually needs;
5. update the staff backup habit: `pg_dump` on the host, not the Staff tools
   button, which will answer `501`.

Media files are not in the database; `backend/media/` must be copied separately
either way.

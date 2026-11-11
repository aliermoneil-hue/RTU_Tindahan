# Team Setup — RTU Tindahan

Everything a member needs to run the project on Windows. Follow it top to
bottom; do not skip the clone step.

> Working on the integrated branch (catalogue API, official store, emailed
> sign-up codes)? Read [`INTEGRATION-SETUP.md`](INTEGRATION-SETUP.md) first — it
> needs one extra `python manage.py migrate` step that this guide predates.

---

## 1. Install these first

| Software | Version | Check |
| --- | --- | --- |
| Python | 3.12+ | `python --version` |
| Node.js | 20 LTS or 22 | `node --version` |
| Git | 2.30+ | `git --version` |
| PostgreSQL | 15+ (optional) | `psql --version` |

Node.js is only needed for the React frontend. PostgreSQL is optional for
local development — the project can use SQLite.

---

## 2. Clone the repository

```powershell
git clone https://github.com/aliermoneil-hue/RTU_Tindahan.git
cd RTU_Tindahan
```

Do **not** use the ZIP download. A ZIP has no `.git` folder, so you cannot pull
updates or open a pull request from it.

---

## 3. Backend — quick start with SQLite (recommended)

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
```

If PowerShell blocks activation:

```powershell
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
```

Open `.env` and confirm this line is **empty**:

```
POSTGRES_DB=
```

Then create the tables and the demo accounts:

```powershell
python manage.py migrate
python manage.py seed_demo_users
python manage.py runserver
```

Open <http://127.0.0.1:8000/>. You should see the API index. The health check
is at <http://127.0.0.1:8000/health/>.

### Demo accounts

| Role | Email | Password |
| --- | --- | --- |
| Administrator | `admin@rtu.edu.ph` | `Tindahan2026!` |
| Office Staff | `staff@rtu.edu.ph` | `Tindahan2026!` |
| Moderator | `moderator@rtu.edu.ph` | `Tindahan2026!` |
| Verified User | `2024-000001@rtu.edu.ph` | `Tindahan2026!` |

Only `admin@rtu.edu.ph` can open Django Admin at
<http://127.0.0.1:8000/admin/>. The others can sign in through the API.

Each member has their own local database. The demo accounts are created by
`seed_demo_users` on **your** machine; they are not stored in GitHub.

---

## 4. Backend — PostgreSQL (optional)

PostgreSQL is the approved stack for the deployed build. Local development can
stay on SQLite.

1. In pgAdmin (or psql), create a login role:

   ```sql
   CREATE ROLE rtu_tindahan LOGIN PASSWORD 'your-password';
   ```

2. Create the database **owned by that role**:

   ```sql
   CREATE DATABASE rtu_tindahan OWNER rtu_tindahan;
   ```

   Creating it while logged in as `postgres` and forgetting the owner is the
   cause of the `permission denied for schema public` error.

3. In `backend/.env`:

   ```
   POSTGRES_DB=rtu_tindahan
   POSTGRES_USER=rtu_tindahan
   POSTGRES_PASSWORD=your-password
   POSTGRES_HOST=localhost
   POSTGRES_PORT=<the port your server listens on>
   ```

   Check the port in pgAdmin: right-click the server → **Properties** →
   **Connection**. It is not always 5432.

4. Run:

   ```powershell
   python manage.py migrate
   python manage.py seed_demo_users
   ```

### If you still get `permission denied for schema public`

Run as the `postgres` superuser, connected to the `postgres` database:

```sql
ALTER DATABASE rtu_tindahan OWNER TO rtu_tindahan;
```

Then connect to the `rtu_tindahan` database and run:

```sql
GRANT ALL ON SCHEMA public TO rtu_tindahan;
```

Verify — the second column must say `rtu_tindahan`:

```sql
SELECT datname, pg_get_userbyid(datdba)
FROM pg_database
WHERE datname = 'rtu_tindahan';
```

If it still says `postgres`, you ran the SQL on a different PostgreSQL
instance than the one in `.env`. Compare the ports.

---

## 5. Frontend (when you work on React)

In a second terminal, with the backend still running:

```powershell
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173/>. The API base URL is read from
`frontend/.env.local` (copy `frontend/.env.example`); the default is
`http://localhost:8000/api/v1`.

---

## 6. Daily Git workflow

```powershell
git switch main
git pull
git switch -c feature/yourname-short-task
# ... work ...
git add .
git commit -m "Add listing filters (BD-02)"
git push -u origin feature/yourname-short-task
```

Then open a Pull Request into `main`. Someone else reviews it and squash
merges.

**Never commit to `main` directly. Never commit `.env`.**

---

## 7. Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| `manage.py` hangs after "System check identified no issues" | `.env` points at PostgreSQL and the connection is blocked. Check `POSTGRES_PORT`; set `POSTGRES_DB=` to use SQLite. |
| `permission denied for schema public` | The database owner is `postgres`, not `rtu_tindahan`. See section 4. |
| `password authentication failed` | `POSTGRES_PASSWORD` does not match the role. Reset it in pgAdmin. |
| "correct email and password for a staff account" | You used a non-admin account at `/admin/`. Use `admin@rtu.edu.ph`. |
| "Email or password is incorrect." | The account does not exist in **your** database. Run `python manage.py seed_demo_users`. |
| "Verify your RTU email before signing in." | New accounts must verify. The link prints in the `runserver` terminal (console email backend). |
| `Activate.ps1 cannot be loaded` | Run `Set-ExecutionPolicy RemoteSigned -Scope CurrentUser` once. |
| `npm` blocked by PowerShell | Same `Set-ExecutionPolicy` fix. |
| `Could not open input file: artisan` | That is the old Laravel setup. This project is Django. |

---

## 8. Useful commands

```powershell
python manage.py check                 # configuration check
python manage.py test                  # run the test suite
python manage.py createsuperuser       # add another administrator
python manage.py seed_demo_users       # recreate the four demo accounts
python manage.py shell                 # interactive shell
```

Documentation lives in `docs/`. The Sprint 1 notes are in
`docs/SPRINT-1-FOUNDATION.md`.

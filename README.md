# RTU Tindahan

An e-commerce web platform for food and merchandise trading at the Rizal
Technological University, Pasig Campus, with LLM-based content screening for
listings, forum posts, comments, and reviews.

**Course:** System Integration and Architecture Laboratory 1 (ICS-501A)
**Status:** In development — initial scaffold

---

## 1. What this system is

A campus marketplace where verified RTU users buy and sell food, merchandise,
books, and manuals. Listings, posts, comments, and reviews pass through a large
language model before publication; anything flagged goes to a human moderator.

This is a **web-based system**, reached through a browser URL. There is no
Android or iOS app. The interface is mobile-first and responsive, but it is
delivered as a website.

### User roles

| Role | Can do |
| --- | --- |
| Visitor | Browse the public catalogue and category pages |
| Verified User | Buy, sell, post in the forum, leave reviews |
| Office Staff | Verify accounts and school credentials |
| Moderator | Review LLM-flagged content, resolve reports |
| Administrator | Full access through Django Admin |

---

## 2. Technology stack

Three-tier client-server architecture.

| Tier | Technology | Version |
| --- | --- | --- |
| Client | React + TypeScript, built with Vite | React 19, Vite 8, TypeScript 6 |
| Application | Django with Django REST Framework | Django 5.2 |
| Data | PostgreSQL | 15 or later |
| Admin screens | Django Admin | bundled with Django |

Supporting services: an LLM API for screening (called only from the Django
server), an email service for verification and password reset, and file storage
for listing and school ID photos.

Full rationale: `docs/RTU-Tindahan-Tech-Stack.txt`.

---

## 3. Repository layout

    RTU_Tindahan/
    ├── backend/            Django project (application tier)
    │   ├── config/         settings, urls, wsgi, asgi
    │   ├── manage.py
    │   ├── requirements.txt
    │   └── .env.example
    ├── frontend/           React + TypeScript app (client tier)
    │   └── src/
    ├── docs/               SRS, tech stack, gap analysis, diagrams
    ├── .gitattributes      line-ending rules for the mixed Windows/Linux team
    ├── .gitignore
    └── CONTRIBUTING.md     team workflow - read this before your first commit

---

## 4. Requirements and installation

### 4.1 Software to install first

| Software | Minimum version | Download | Verify it worked |
| --- | --- | --- | --- |
| Python | 3.12 or later | https://www.python.org/downloads/ | `python --version` |
| Node.js | 20 LTS or later | https://nodejs.org/ | `node --version` |
| npm | ships with Node.js | — | `npm --version` |
| Git | 2.30 or later | https://git-scm.com/downloads | `git --version` |
| PostgreSQL | 15 or later | https://www.postgresql.org/download/ | `psql --version` |

On Windows, use the installer from python.org and **tick "Add python.exe to
PATH"** on the first screen. If you skip it, `python` will not be recognised
later.

**Do not `pip install django` yet.** It goes into the project's own virtual
environment in step 4.2, not into the system Python.

**Python version note.** The approved tech stack specifies Python 3.12 or
later. Django 5.2.18 itself supports Python 3.10 through 3.14, so 3.12, 3.13,
and 3.14 all work and the commands below do not change. On Windows, `py -0`
lists every version you have, and `py -3.12 -m venv .venv` forces a specific one.

### 4.2 Backend installation

    cd backend
    python -m venv .venv

    # Windows
    .venv\Scripts\activate

    # Linux / macOS
    source .venv/bin/activate

Your prompt now begins with `(.venv)`. Then install the requirements:

    python -m pip install --upgrade pip
    pip install -r requirements.txt

`requirements.txt` installs five packages:

| Package | Version | Purpose |
| --- | --- | --- |
| Django | 5.2.18 | Web framework and Django Admin |
| djangorestframework | 3.18.3 | REST API for the React frontend |
| django-cors-headers | 4.9.0 | Lets the frontend call the API from another port |
| python-dotenv | 1.2.4 | Reads `backend/.env` into Django settings |
| psycopg | 3.3.6 | PostgreSQL driver |

Confirm the install landed in the venv:

    python -c "import django; print(django.get_version())"

It must print `5.2.18`. Then create your environment file and start the server:

    cp .env.example .env          # Windows: copy .env.example .env
    python manage.py migrate
    python manage.py runserver

Backend runs at http://localhost:8000

> Every `pip install` and `python manage.py` command must run with the virtual
> environment **activated**. If a command says "No module named django", the
> venv is not active — that is the cause nine times out of ten.

### 4.3 Frontend installation

In a second terminal:

    cd frontend
    npm install
    npm run dev

Frontend runs at http://localhost:5173

`npm install` reads `package.json` and `package-lock.json` and builds the
`node_modules/` folder. It takes a minute on the first run and is never
committed — the lock file is, which is what keeps everyone on identical
package versions.

Both servers must be running at the same time during development.

### 4.4 Database installation (PostgreSQL)

The approved stack uses PostgreSQL. The scaffold currently points Django at
SQLite so that the backend runs before anyone has set up a database server.
The psycopg driver is already installed, so only the server and the settings
remain.

1. Install PostgreSQL. Remember the password you set for the `postgres`
   superuser during installation.
2. Create the database and its user:

        psql -U postgres

   Then at the `postgres=#` prompt:

        CREATE DATABASE rtu_tindahan;
        CREATE USER rtu_tindahan WITH PASSWORD 'choose-a-password';
        GRANT ALL PRIVILEGES ON DATABASE rtu_tindahan TO rtu_tindahan;
        \q

3. Put those same values into `backend/.env`.
4. Point the `DATABASES` setting in `backend/config/settings.py` at those
   variables. This is not done yet — see section 6.
5. Run the migrations against the new database:

        python manage.py migrate

### 4.5 Running the whole system

Two terminals, both left open:

| Terminal | Directory | Command | Serves |
| --- | --- | --- | --- |
| 1 — backend | `backend/` | `python manage.py runserver` | http://localhost:8000 |
| 2 — frontend | `frontend/` | `npm run dev` | http://localhost:5173 |

Open http://localhost:5173 in the browser. That is the application; it calls
the backend on port 8000.

### 4.6 If the installation fails

| Message you see | Cause | Fix |
| --- | --- | --- |
| `python: command not found` | Python is not on your PATH | Reinstall with "Add python.exe to PATH" ticked. On Windows, `py` also works. |
| `python` opens the Microsoft Store | The Store alias is intercepting | Settings → Apps → Advanced app settings → App execution aliases → turn off `python.exe` |
| `Could not find a version that satisfies the requirement Django==5.2.18` | pip cannot reach PyPI, or the package name is mistyped | Check your internet connection and that no proxy blocks pip |
| `Ignored the following versions that require a different python version` | Your Python is older than 3.10 | Install Python 3.12 or later |
| `pip: command not found` | The venv is not activated | See step 4.2 |
| `No module named 'django'` | `pip install` ran outside the venv | Activate the venv, then `pip install -r requirements.txt` again |
| `npm ERR! ... EBADENGINE` | Node.js is too old | Install Node 20 LTS or later |
| `psql: command not found` | PostgreSQL tools are not on PATH | On Windows, tick "Command Line Tools" in the PostgreSQL installer |
| `Error: That port is already in use` | Something already runs on 8000 or 5173 | Stop the other process, or run `python manage.py runserver 8001` |

If an error is not in this table, paste the **full** message into the group
chat. The last line usually names the cause; the lines above it usually name
the package.

### 4.7 Before you start coding

Read `CONTRIBUTING.md`. The short version: **never commit to `main`** — branch
as `feature/<your-name>-<task>`, push, and open a pull request.

---

## 5. Environment and secrets

Real values live in `backend/.env`, which is gitignored. `backend/.env.example`
lists every key the system needs and is safe to commit.

Never paste an API key into a file that is not gitignored. If you commit one by
accident, tell the team and rotate the key — deleting the file in a later commit
does not remove it from history.

---

## 6. Still to be wired up

These are known gaps in the scaffold, each a good first task:

- [ ] Read `SECRET_KEY`, `DEBUG`, and database settings from `.env` instead of the hardcoded defaults in `backend/config/settings.py`
- [ ] Add `rest_framework` and `corsheaders` to `INSTALLED_APPS` in `backend/config/settings.py`
- [ ] Create a PostgreSQL database and run the first migration against it
- [ ] Install and configure Tailwind CSS with the RTU Tindahan theme colours
- [ ] Move the approved documents from the CapStone folder into `docs/`
- [ ] Port the working HTML prototype into React components

---

## 7. Team

| Name | Role | GitHub |
| --- | --- | --- |
| Neil Ryan Aliermo | Repo owner | @aliermoneil-hue |
| | | |
| | | |
| | | |

---

## 8. License

No licence is granted. This is coursework for ICS-501A and is not intended for
public reuse.

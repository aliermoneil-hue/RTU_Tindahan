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

## 4. Getting started

Prerequisites: **Python 3.11 or later**, **Node.js 20 or later**, **Git**.

### 4.1 Backend

    cd backend
    python -m venv .venv

    # Windows
    .venv\Scripts\activate

    # Linux / macOS
    source .venv/bin/activate

    pip install -r requirements.txt
    cp .env.example .env      # then fill in real values
    python manage.py migrate
    python manage.py runserver

Backend runs at http://localhost:8000

### 4.2 Frontend

In a second terminal:

    cd frontend
    npm install
    npm run dev

Frontend runs at http://localhost:5173

Both must be running at the same time during development.

### 4.3 Before you start coding

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

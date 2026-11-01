# Admin front end

React screens for staff, built on the Sprint 1 API. They live in
`frontend/src/admin/` and are served under `/admin`, so the student screens
(Sprint 2) can take over every other URL without touching this folder.

SRS references: AD-01 (accounts, roles, suspend and reactivate), AV-03
(verification), SE-04 (30-minute session timeout), and the five user classes
in section 2.

---

## 1. Run it

Backend and frontend as in `README.md` section 4, then:

    cd backend
    python manage.py migrate
    python manage.py seed_demo_users
    python manage.py runserver

    cd frontend
    npm run dev

Open <http://localhost:5173/admin>. No new npm packages were added, so
`package.json` and `package-lock.json` are unchanged.

| Sign in as | Email | Sees |
| --- | --- | --- |
| Administrator | `admin@rtu.edu.ph` | Dashboard, Accounts, Verification queue, role and status editing |
| Office Staff | `staff@rtu.edu.ph` | Dashboard, Accounts, Verification queue, verify button |
| Moderator | `moderator@rtu.edu.ph` | Dashboard totals only |
| Verified User | `2024-000001@rtu.edu.ph` | "No access" screen |

Password for all four: `Tindahan2026!`

---

## 2. Screens

| URL | Screen | What it does |
| --- | --- | --- |
| `/admin/login` | Sign in | Token login. Shows the server's message for wrong password, unverified, suspended, banned, and throttled attempts. |
| `/admin` | Dashboard | Totals, accounts by role and status, newest accounts, server and database health. |
| `/admin/accounts` | Accounts | Search by name, email, or college. Filter by role, status, verified. Sort. 20 per page. Filters stay in the URL, so a filtered view can be bookmarked. |
| `/admin/accounts?verified=false` | Verification queue | The same table, filtered to unverified accounts. |

Clicking a row opens a side panel with the account details.

- **Office Staff and Administrator:** "Verify this account" (also gives the Verified User role).
- **Administrator only:** change the role; suspend, ban, or reactivate. A
  suspension or ban needs a written reason, which is kept on the account. The
  person is signed out at once.

The session ends after 30 minutes without activity (SE-04) and whenever the
server answers 401.

### Theme and motion

- **Light, Auto, Dark** switch in the sidebar (and on the sign-in page). Auto
  follows the computer's setting. The choice is saved in this browser under
  `rtu_admin_theme`. Colors are tokens at the top of `admin/admin.css`; the
  dark palette is one block there.
- **Between screens:** the new screen slides in from the side it sits on in
  the menu (Dashboard, then Accounts, then Verification queue), and the page
  scrolls back to the top.
- **Table:** the next page slides in from the right, the previous page from
  the left, and the view glides back up to the search bar.
- **Other motion:** numbers on the dashboard count up, bars grow, the account
  panel slides in and out, a wrong password shakes the message, and a
  back-to-top button appears after scrolling.
- Everything stops when the computer is set to "reduce motion".

No backend change was needed for any of this.

---

## 3. New API endpoints

All under `/api/v1/admin/`. Every one repeats the role check on the server.

| Method | Endpoint | Who | Purpose |
| --- | --- | --- | --- |
| GET | `/admin/summary/` | Office Staff, Moderator, Administrator | Dashboard counts. Moderators get counts only, no names. |
| GET | `/admin/users/` | Office Staff, Administrator | Paged list. Query: `q`, `role`, `status`, `member_type`, `verified` (`true` or `false`), `ordering`, `page`, `page_size` (max 100). |
| GET | `/admin/users/<id>/` | Office Staff, Administrator | One account. |
| PATCH | `/admin/users/<id>/` | Administrator | Change `role`, `status`, `status_note`. |
| POST | `/admin/users/<id>/verify/` | Office Staff, Administrator | Manual verification. |

Rules in the PATCH endpoint:

- You cannot change your own role or status.
- The last active administrator cannot be demoted, suspended, or banned.
- Suspending or banning needs a reason in `status_note`.
- A role above Visitor needs a verified account.
- Suspending or banning deletes the account's login tokens.

Files: `apps/accounts/admin_views.py`, `admin_serializers.py`, the
`IsBackOffice` class in `permissions.py`, routes in `urls.py`, and
`tests/test_admin_api.py`.

---

## 4. Code map

    frontend/src/
    ├── main.tsx            unchanged
    ├── App.tsx             sends /admin to the admin area; placeholder for the rest
    └── admin/
        ├── AdminApp.tsx    sign-in gate and routes
        ├── admin.css       design tokens, light and dark palettes, styles, animations
        ├── auth/           AuthContext: token, restore on reload, idle timeout
        ├── lib/            api.ts (fetch client), router.tsx, types.ts, format.ts,
        │                   theme.ts (light/dark choice), motion.ts (count-up, scrolling)
        ├── components/     Layout, AccountPanel, Badge, ThemeToggle,
        │                   PageTransition, BackToTop
        └── pages/          LoginPage, DashboardPage, AccountsPage

`lib/router.tsx` is an 80-line history router. When the student site adopts
React Router, replace that one file; the screens only use `Link`,
`navigate`, `useLocation`, and `useSearchParams`.

The API base URL comes from `VITE_API_BASE_URL` (see `frontend/.env.example`).
The token is kept in `localStorage` under `rtu_admin_token`.

---

## 5. Not built yet

- Audit log screen (AD-05). It needs the audit model first (Sprint 2 list).
- Moderator queue for flagged content (AI-xx). It needs the screening app.
- Categories management (AD-03). It needs the `listings` app.
- Password reset and expiring tokens (see `SPRINT-1-FOUNDATION.md` section 5).

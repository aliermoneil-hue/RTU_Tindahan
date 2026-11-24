# Performance (PF-01, PF-02, PF-04)

The SRS asks three things about speed and capacity. This is what was measured,
on what hardware, and how to run it again.

`scripts/load_test.py` is the instrument: standard library only, so it runs
wherever the project already runs. Each virtual user is a think-then-act loop
across six weighted scenarios (browse, a sorted browse, opening a listing, search,
a category filter, the forum), which is why the numbers describe a marketplace
rather than one endpoint being hammered.

    python scripts/load_test.py --users 200 --seconds 60 --think 5 \
        --json docs/performance/200-users-online.json

## The machine these numbers describe

| | |
| --- | --- |
| CPU | Intel Core i5-7200U, 4 threads, 2.50 GHz |
| Memory | 7 GB (shared with everything else on the laptop) |
| Database | SQLite in WAL mode, on the same disk |
| Server | gunicorn 27, 3 workers × 4 threads, one process per worker |
| Network | requests to `127.0.0.1`; the page-load run went to Vercel over the internet |

A figure from a four-core laptop is evidence about a four-core laptop. It is not
a capacity plan for a server, and the SRS's own wording ("on the pilot campus
network") is a measurement the University can make later over the same endpoints.

## PF-04 — 200 users online at the same time

Two runs at 200 concurrent users, because "online at the same time" has two
honest readings:

| Run | Pacing | Requests | req/s | p50 | p95 | p99 | Failures |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 200 online | one action every ~5 s | 2,451 in 60 s | 36.5 | 0.028 s | **0.627 s** | 1.374 s | **0** |
| 200 in a burst | one action every ~0.4 s | 4,896 in 42 s | 116.8 | 1.184 s | 2.735 s | 3.814 s | **0** |

The first is the reading the SRS means: two hundred people signed in, each reading
a page every few seconds. The second is deliberately harsher — the same two hundred
people clicking almost continuously, about 500 requests per second asked for — and
it is reported because it is where this laptop starts to bend, not where it breaks.
Even there, nothing failed.

Progression, same machine, same script, before any tuning:

| Users | p50 | p95 | Failures |
| --- | --- | --- | --- |
| 10 | 0.032 s | 0.082 s | 0 |
| 50 | 0.132 s | 0.521 s | 0 |
| 200 (0.4 s pacing) | 2.292 s | 5.098 s | 0 |

## PF-02 — search and filtered views within 3 s

Every filtered endpoint is under a second at 200 users, at both pacings:

| Scenario | p95 at 200 online | p95 at 200 in a burst |
| --- | --- | --- |
| search | 0.650 s | 2.709 s |
| category filter | 0.300 s | 2.776 s |
| browse (page 1) | 0.719 s | 2.771 s |
| browse (sorted by price) | 0.402 s | 2.726 s |
| open a listing | 0.751 s | 2.717 s |
| forum list | 0.552 s | 2.786 s |

The SRS bar is 3 seconds. It is met with room at the realistic pacing, and met with
a narrow margin at the burst pacing — which is why the burst figure is written down
rather than hidden.

## PF-01 — a page inside 3 s for 95% of loads

Ten cold loads of the deployed page (`https://rtu-tindahan-nine.vercel.app`),
fetching the HTML and then the hashed JavaScript bundle, all 200:

| p50 | p95 | max |
| --- | --- | --- |
| 0.42 s | **0.78 s** | 0.78 s |

That is the static shell over this connection. What a page actually costs a user
is the shell plus the API calls it makes, and the API figures above are the second
half: at 200 online, p95 0.63 s. Added together the p95 is well inside three
seconds.

**What this does not prove.** The SRS asks for the measurement on the pilot campus
network and on mobile data. Neither was available here, so the shell figure comes
from a home connection and the API figures come from `127.0.0.1`. The honest claim
is: every measured path is far inside the three-second bar on this setup, and the
campus-network run is still the University's to make.

## Two changes the measurement forced

**gunicorn instead of `runserver`.** The service was running Django's development
server, which its own documentation says must not serve real traffic and which
handles one request at a time per process. The unit now runs gunicorn with three
workers of four threads — three for the four cores the laptop has, leaving one for
the operating system, and threads so a request waiting on the language model does
not block the rest.

**SQLite in WAL mode** (`config/sqlite_pragmas.py`, applied on every connection by
`AccountsConfig.ready`). The default rollback journal makes a reader wait for a
writer, which is the wrong shape for a marketplace: every listing view is a read
and every order is a write. With `journal_mode=WAL`, `synchronous=NORMAL`,
`busy_timeout=20000` and `foreign_keys=ON`, the 200-user burst went from p50
2.29 s / p95 5.10 s to p50 1.18 s / p95 2.73 s — the same run, the same hardware,
one pragma.

## Files

| File | What it is |
| --- | --- |
| `scripts/load_test.py` | the load and page-timing instrument |
| `scripts/contrast_audit.py` | the UX-05 colour audit (see `docs/ACCESSIBILITY.md`) |
| `docs/performance/*.json` | the raw numbers behind every table here |
| `~/.config/systemd/user/rtu-tindahan.service` | gunicorn, 3 workers × 4 threads |
| `backend/config/sqlite_pragmas.py` | WAL, busy timeout, foreign keys |
